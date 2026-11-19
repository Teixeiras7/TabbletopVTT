"use client";

import { useFormStatus } from "react-dom";
import { confirm } from "@/components/confirm";

export function ConfirmSubmitButton({
  message,
  className,
  children,
}: {
  message: string;
  className: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={async (event) => {
        event.preventDefault();
        const form = event.currentTarget.form;
        if (await confirm(message, { confirmLabel: "Confirmar" })) form?.requestSubmit();
      }}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}
