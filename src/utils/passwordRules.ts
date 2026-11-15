/**
 * LABVERSE Password Validation & Recovery Rules
 * Enforces strong password criteria and secure matching for password recovery.
 */

export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  valid: boolean;
  score: number; // 0 - 4
  strengthLabel: 'Very Weak' | 'Weak' | 'Medium' | 'Strong';
  requirements: PasswordRequirement[];
  errors: string[];
}

export const validatePasswordStrength = (password: string): PasswordStrengthResult => {
  const requirements: PasswordRequirement[] = [
    {
      id: 'min_length',
      label: 'At least 8 characters',
      met: password.length >= 8,
    },
    {
      id: 'has_uppercase',
      label: 'Contains an uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'has_lowercase',
      label: 'Contains a lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      id: 'has_number_or_symbol',
      label: 'Contains a number (0-9) or symbol (@$!%*?&)',
      met: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    },
  ];

  const metCount = requirements.filter((r) => r.met).length;
  const errors: string[] = requirements.filter((r) => !r.met).map((r) => r.label);

  let strengthLabel: 'Very Weak' | 'Weak' | 'Medium' | 'Strong' = 'Very Weak';
  if (metCount === 4) {
    strengthLabel = 'Strong';
  } else if (metCount === 3) {
    strengthLabel = 'Medium';
  } else if (metCount >= 1) {
    strengthLabel = 'Weak';
  }

  return {
    valid: metCount === requirements.length,
    score: metCount,
    strengthLabel,
    requirements,
    errors,
  };
};

export const validatePasswordConfirmation = (
  password: string,
  confirmPassword: string
): { matches: boolean; error?: string } => {
  if (!confirmPassword) {
    return { matches: false, error: 'Please confirm your new password.' };
  }
  if (password !== confirmPassword) {
    return { matches: false, error: 'Passwords do not match.' };
  }
  return { matches: true };
};
