"use client";

import { FormEvent, useState, useEffect } from "react";
import { Eye, EyeOff, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";

import { changePassword, getCurrentUser, updateProfile } from "../../../../lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function SettingsPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [updatingName, setUpdatingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) setName(user.name);
    });
  }, []);

  async function handleUpdateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setUpdatingName(true);
    try {
      await updateProfile(name);
      toast.success("Profile updated successfully.");
    } catch (caught) {
      setNameError(caught instanceof Error ? caught.message : "Failed to update profile.");
    } finally {
      setUpdatingName(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to change password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
      <p className="mt-2 text-sm text-muted-foreground">Manage your account settings and preferences.</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-medium text-card-foreground">Profile Details</h2>
        <form onSubmit={handleUpdateName} className="mt-6 max-w-md">
          <Label className="block text-sm font-medium text-foreground" htmlFor="name">Full Name</Label>
          <Input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2"
          />
          {nameError && <p role="alert" className="mt-4 text-sm text-destructive">{nameError}</p>}
          
          <Button
            type="submit"
            disabled={updatingName}
            className="mt-6 gap-2"
          >
            {updatingName ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {updatingName ? "Saving..." : "Save changes"}
          </Button>
        </form>
      </div>

      <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-xs">
        <h2 className="text-lg font-medium text-card-foreground">Change Password</h2>
        <form onSubmit={handleSubmit} className="mt-6 max-w-md">
          <Label className="block text-sm font-medium text-foreground" htmlFor="currentPassword">Current Password</Label>
          <div className="relative mt-2">
            <Input
              id="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Label className="mt-5 block text-sm font-medium text-foreground" htmlFor="newPassword">New Password</Label>
          <div className="relative mt-2">
            <Input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Label className="mt-5 block text-sm font-medium text-foreground" htmlFor="confirmPassword">Confirm New Password</Label>
          <div className="relative mt-2">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          
          <Button
            type="submit"
            disabled={submitting}
            className="mt-6 gap-2"
          >
            {submitting ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {submitting ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
