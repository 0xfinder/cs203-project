"use client";
import * as React from "react";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export const Dialog = RadixDialog.Root;

export function DialogTrigger({ children, ...props }: any) {
  return <RadixDialog.Trigger {...props}>{children}</RadixDialog.Trigger>;
}

export function DialogPortal({ children }: { children: React.ReactNode }) {
  return (
    <RadixDialog.Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {children}
      </div>
    </RadixDialog.Portal>
  );
}

export function DialogOverlay(props: any) {
  return <RadixDialog.Overlay className="fixed inset-0 bg-black/40 z-40" {...props} />;
}

export function DialogContent({ children, title, description, ...props }: any) {
  return (
    <RadixDialog.Portal>
      <DialogOverlay />
      <RadixDialog.Content
        {...props}
        className="fixed top-1/2 left-1/2 z-50 w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-background p-6 shadow-lg mx-4"
      >
        <div className="flex items-start justify-between">
          {title && (
            <RadixDialog.Title className="text-lg font-bold">{title}</RadixDialog.Title>
          )}
          <RadixDialog.Close asChild>
            <button aria-label="Close" className="-m-2 rounded p-2 hover:bg-muted">
              <X className="size-4" />
            </button>
          </RadixDialog.Close>
        </div>
        {description ? (
          <RadixDialog.Description className="mt-2 text-sm text-muted-foreground">{description}</RadixDialog.Description>
        ) : (
          <RadixDialog.Description className="sr-only">{title ? `${title} dialog` : "Dialog"}</RadixDialog.Description>
        )}
        <div className="mt-4">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export const DialogTitle = RadixDialog.Title;
export const DialogDescription = RadixDialog.Description;

export const DialogClose = RadixDialog.Close;

export default Dialog;
