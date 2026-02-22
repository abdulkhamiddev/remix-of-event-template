import React, { useMemo } from "react";
import { Progress } from "@/components/ui/progress.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import {
  PasswordServerIssue,
  evaluatePasswordStrength,
} from "@/lib/passwordStrength.ts";

interface PasswordStrengthProps {
  password: string;
  identifier: string;
  serverIssues?: PasswordServerIssue[];
}

type RuleStatus = "pass" | "fail" | "server";

const statusClass: Record<RuleStatus, string> = {
  pass: "text-emerald-600",
  fail: "text-destructive",
  server: "text-muted-foreground",
};

const statusMark: Record<RuleStatus, string> = {
  pass: "[OK]",
  fail: "[NO]",
  server: "[..]",
};

const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password,
  identifier,
  serverIssues = [],
}) => {
  const evaluation = useMemo(
    () => evaluatePasswordStrength(password, identifier),
    [password, identifier],
  );

  const serverCodes = useMemo(
    () => new Set(serverIssues.map((item) => item.code)),
    [serverIssues],
  );

  const strengthColor =
    evaluation.label === "Strong"
      ? "text-emerald-600"
      : evaluation.label === "OK"
        ? "text-amber-600"
        : "text-destructive";

  const rules: Array<{
    key: string;
    label: string;
    status: RuleStatus;
    tooltip?: string;
  }> = [
    {
      key: "min_length",
      label: "At least 8 characters",
      status: serverCodes.has("min_length")
        ? "fail"
        : evaluation.checks.minLength
          ? "pass"
          : "fail",
    },
    {
      key: "common_password",
      label: "Not a common password",
      status: serverCodes.has("common_password") ? "fail" : "server",
      tooltip: "This rule is checked authoritatively by the server.",
    },
    {
      key: "numeric_only",
      label: "Not all numeric",
      status: serverCodes.has("numeric_only")
        ? "fail"
        : evaluation.checks.notNumericOnly
          ? "pass"
          : "fail",
    },
    {
      key: "too_similar",
      label: "Not similar to email/username",
      status: serverCodes.has("too_similar")
        ? "fail"
        : evaluation.checks.notSimilarToIdentifier
          ? "pass"
          : "fail",
    },
    {
      key: "mix",
      label: "Includes letters + numbers",
      status: evaluation.checks.hasLetterAndNumber ? "pass" : "fail",
    },
  ];

  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/20 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Password strength</span>
        <span className={`font-medium ${strengthColor}`}>{evaluation.label}</span>
      </div>
      <Progress value={password ? evaluation.percent : 0} className="h-2" />

      <ul className="space-y-1 text-sm">
        {rules.map((rule) => (
          <li key={rule.key} className={`flex items-center gap-2 ${statusClass[rule.status]}`}>
            <span className="font-mono text-xs">{statusMark[rule.status]}</span>
            <span>{rule.label}</span>
            {rule.tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2"
                    aria-label={`${rule.label} info`}
                  >
                    info
                  </button>
                </TooltipTrigger>
                <TooltipContent>{rule.tooltip}</TooltipContent>
              </Tooltip>
            )}
          </li>
        ))}
      </ul>

      {serverIssues.length > 0 && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-2 text-sm text-destructive">
          <p className="font-medium">Server validation:</p>
          <ul className="mt-1 space-y-1">
            {serverIssues.map((item, idx) => (
              <li key={`${item.code}-${idx}`}>{item.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default PasswordStrength;

