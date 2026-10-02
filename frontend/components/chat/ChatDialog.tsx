"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import ChatPanel from "@/components/chat/ChatPanel";

export default function ChatDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
    };

    window.addEventListener("open-amaya-chat", handleOpen);

    // If page is loaded with hash #chat, open automatically
    if (window.location.hash === "#chat") {
      setIsOpen(true);
    }

    const handleHashChange = () => {
      if (window.location.hash === "#chat") {
        setIsOpen(true);
      }
    };
    window.addEventListener("hashchange", handleHashChange);

    return () => {
      window.removeEventListener("open-amaya-chat", handleOpen);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Floating "Ask Amaya" trigger button when closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              aria-label="Open chat with Amaya"
              className="group flex cursor-pointer items-center gap-3 rounded-full bg-brand py-2 pl-2 pr-5 text-on-brand shadow-xl ring-2 ring-white/20 transition-all hover:bg-[#233c32] hover:shadow-2xl hover:scale-105 active:scale-95"
            >
              <div className="relative size-10 overflow-hidden rounded-full ring-2 ring-white/40">
                <Image
                  src="/images/amaya_avatar.png"
                  alt="Amaya"
                  width={40}
                  height={40}
                  className="size-full object-cover"
                />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold leading-tight">Ask Amaya</p>
                <p className="text-[10px] text-white/70">Online now</p>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slide-over Dialog */}
      <div
        className={`fixed inset-0 z-50 flex justify-end ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
      >
        {/* Backdrop */}
        <motion.div
          initial={false}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => setIsOpen(false)}
          className={`fixed inset-0 bg-black/50 backdrop-blur-xs ${
            isOpen ? "pointer-events-auto" : "pointer-events-none"
          }`}
          aria-hidden="true"
        />

        {/* Slide-in Container */}
        <motion.div
          initial={false}
          animate={{ x: isOpen ? 0 : "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="relative z-50 flex h-full w-full max-w-lg flex-col bg-surface shadow-2xl sm:max-w-xl pointer-events-auto"
        >
          <div className="h-full w-full overflow-hidden">
            <ChatPanel
              className="h-full max-h-none min-h-0 rounded-none border-0 shadow-none lg:h-full lg:max-h-none lg:sticky-none"
              onClose={() => setIsOpen(false)}
              isOpen={isOpen}
            />
          </div>
        </motion.div>
      </div>
    </>
  );
}
