export type AuthUser = {
  id: string;
  email: string;
  display_name: string;
  role: string;
  provider: "password" | "google";
  avatar_url: string | null;
};

export type AuthErrorBody = {
  error?: { code?: string; message?: string; request_id?: string; details?: unknown[] };
};

export type Challenge = {
  challenge_id: string;
  purpose: "registration" | "password_reset";
  masked_email: string;
  delivery_status: string;
  expires_at: string;
  resend_available_at: string;
  consumed: boolean;
};
