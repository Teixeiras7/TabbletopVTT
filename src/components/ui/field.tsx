import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

// Versão enxuta do componente Field do shadcn: só o que os formulários do
// projeto usam (rótulo + campo + erro). Sem FieldSet/FieldLegend/FieldSeparator,
// que exigiriam mais componentes sem ter um uso real ainda.

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("flex w-full flex-col gap-5", className)} {...props} />;
}

function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="field"
      className={cn("flex w-full flex-col gap-1.5 data-[invalid=true]:text-destructive", className)}
      {...props}
    />
  );
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return <Label data-slot="field-label" className={cn("w-fit", className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-sm leading-normal text-muted-foreground [&>a]:font-medium [&>a]:text-foreground [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className,
      )}
      {...props}
    />
  );
}

function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p role="alert" data-slot="field-error" className={cn("text-sm text-destructive", className)} {...props}>
      {children}
    </p>
  );
}

export { Field, FieldGroup, FieldLabel, FieldDescription, FieldError };
