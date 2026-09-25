"use client";

import { FormEvent, useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { changePassword, getCurrentUser, updateProfile } from "../../../../lib/api";

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
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 text-sm text-[#64736b]">Manage your account settings and preferences.</p>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h2 className="text-lg font-medium">Profile Details</h2>
        <form onSubmit={handleUpdateName} className="mt-6 max-w-md">
          <label className="block text-sm font-medium" htmlFor="name">Full Name</label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 outline-none focus:border-[#28513f]"
          />
          {nameError && <p role="alert" className="mt-4 text-sm text-red-700">{nameError}</p>}
          
          <button
            type="submit"
            disabled={updatingName}
            className="mt-6 rounded-lg bg-[#19352b] dark:bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-200 transition-colors hover:bg-[#132820] dark:hover:bg-zinc-900 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          >
            {updatingName ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h2 className="text-lg font-medium">Change Password</h2>
        <form onSubmit={handleSubmit} className="mt-6 max-w-md">
          <label className="block text-sm font-medium" htmlFor="currentPassword">Current Password</label>
          <div className="relative mt-2">
            <input
              id="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              required
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 pr-10 outline-none focus:border-[#28513f]"
            />
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078] dark:text-zinc-400 hover:text-[#1a2923] dark:text-zinc-200 focus:outline-none"
              aria-label={showCurrentPassword ? "Hide password" : "Show password"}
            >
              {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="mt-5 block text-sm font-medium" htmlFor="newPassword">New Password</label>
          <div className="relative mt-2">
            <input
              id="newPassword"
              type={showNewPassword ? "text" : "password"}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 pr-10 outline-none focus:border-[#28513f]"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078] dark:text-zinc-400 hover:text-[#1a2923] dark:text-zinc-200 focus:outline-none"
              aria-label={showNewPassword ? "Hide password" : "Show password"}
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="mt-5 block text-sm font-medium" htmlFor="confirmPassword">Confirm New Password</label>
          <div className="relative mt-2">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 pr-10 outline-none focus:border-[#28513f]"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078] dark:text-zinc-400 hover:text-[#1a2923] dark:text-zinc-200 focus:outline-none"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
          
          <button
            type="submit"
            disabled={submitting}
            className="mt-6 rounded-lg bg-[#19352b] dark:bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-200 transition-colors hover:bg-[#132820] dark:hover:bg-zinc-900 disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          >
            {submitting ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
