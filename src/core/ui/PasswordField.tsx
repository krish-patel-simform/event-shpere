"use client";

import { useState } from "react";
import { TextField, type TextFieldProps } from "./TextField";

/** A TextField for passwords with a Show / Hide toggle. Pass autoComplete (current/new-password). */
export function PasswordField(props: Omit<TextFieldProps, "type" | "trailing">) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="rounded text-sm font-semibold text-brand"
        >
          {visible ? "Hide" : "Show"}
        </button>
      }
    />
  );
}
