import { useRef, useState } from "react";

type FieldName = "name" | "email" | "subject" | "content";
type FieldErrors = Partial<Record<FieldName, string>>;
type Status = "idle" | "submitting" | "ok" | "busy" | "unavailable" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTENT_MIN = 10;
const CONTENT_MAX = 2000;
const CONTENT_NEAR = CONTENT_MAX - 200;

/**
 * Contact form island — posts a message to `/api/contact/messages`.
 *
 * Validation rules and base copy are ported from the live dist bundle
 * (`ContactForm.astro_astro_type_script_index_0_lang.*.js`). On top of
 * that: per-field validation on blur, errors clear as the visitor fixes
 * the field, the first invalid field is focused after a failed submit,
 * a live character hint under the message field, and distinct feedback
 * for 429 (rate limited) / 503 (backend down) responses.
 */
export default function ContactForm({
  fallbackEmail = "3992237161@qq.com",
}: {
  /** Address shown when the API call fails, so the user can still reach out. */
  fallbackEmail?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [contentLength, setContentLength] = useState(0);
  const [contentTrim, setContentTrim] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const inflight = useRef(false);

  function syncContent(value: string) {
    setContentLength(value.length);
    setContentTrim(value.trim().length);
  }

  function dismissStatus() {
    setStatus((current) => (current === "submitting" ? current : "idle"));
  }

  function validateField(name: FieldName, value: string): string | undefined {
    if (name === "name" && !value.trim()) return "请填写姓名";
    if (name === "email") {
      const email = value.trim();
      if (email && !EMAIL_PATTERN.test(email)) return "邮箱格式不正确";
    }
    if (name === "subject" && !value.trim()) return "请填写主题";
    if (name === "content") {
      const trimmed = value.trim();
      if (!trimmed) return "请填写消息";
      if (trimmed.length < CONTENT_MIN) return `消息至少 ${CONTENT_MIN} 个字`;
      if (value.length > CONTENT_MAX) return `消息最多 ${CONTENT_MAX} 个字`;
    }
    return undefined;
  }

  function validate(values: Record<FieldName, string>): FieldErrors {
    const next: FieldErrors = {};
    for (const name of Object.keys(values) as FieldName[]) {
      const error = validateField(name, values[name]);
      if (error) next[name] = error;
    }
    setErrors(next);
    return next;
  }

  /** Validate one field when the visitor leaves it. */
  function handleBlur(event: React.FocusEvent<HTMLElement>) {
    const field = event.target;
    if (
      !(field instanceof HTMLInputElement) &&
      !(field instanceof HTMLTextAreaElement)
    ) {
      return;
    }
    const name = field.name as FieldName;
    const error = validateField(name, field.value);
    setErrors((current) => ({ ...current, [name]: error }));
  }

  /** Clear the field's error as soon as the visitor edits it again. */
  function clearError(name: FieldName) {
    setErrors((current) =>
      current[name] ? { ...current, [name]: undefined } : current,
    );
  }

  function focusFirstError(fieldErrors: FieldErrors) {
    const order: FieldName[] = ["name", "email", "subject", "content"];
    const first = order.find((name) => fieldErrors[name]);
    if (!first) return;
    const field = formRef.current?.elements.namedItem(first);
    if (field instanceof HTMLElement) field.focus();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inflight.current) return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<FieldName, string> = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      content: String(formData.get("content") ?? ""),
    };

    const fieldErrors = validate(values);
    if (Object.keys(fieldErrors).some((name) => fieldErrors[name as FieldName])) {
      setStatus("idle");
      focusFirstError(fieldErrors);
      return;
    }

    inflight.current = true;
    setStatus("submitting");
    try {
      const response = await fetch("/api/contact/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: values.name.trim(),
          email: values.email.trim(),
          subject: values.subject.trim(),
          content: values.content.trim(),
        }),
      });
      if (response.status === 429) {
        setStatus("busy");
        return;
      }
      if (response.status === 503) {
        setStatus("unavailable");
        return;
      }
      if (!response.ok) throw new Error("failed");
      setStatus("ok");
      form.reset();
      setErrors({});
      syncContent("");
    } catch {
      setStatus("error");
    } finally {
      inflight.current = false;
    }
  }

  const statusMessage =
    status === "submitting"
      ? "发送中…"
      : status === "ok"
        ? "已收到，谢谢你的留言！"
        : status === "busy"
          ? "发送太频繁了，请稍等片刻再试。"
          : status === "unavailable"
            ? `留言服务暂时不可用——可以稍后再试，或直接邮件联系 ${fallbackEmail}`
            : status === "error"
              ? `发送失败，请直接邮件联系 ${fallbackEmail}`
              : "";

  const hintText =
    contentLength === 0
      ? ""
      : contentLength >= CONTENT_MAX
        ? `已写满 ${CONTENT_MAX} 字`
        : contentTrim < CONTENT_MIN
          ? `还差 ${CONTENT_MIN - contentTrim} 个字（至少 ${CONTENT_MIN} 字）· ${contentLength} / ${CONTENT_MAX}`
          : `${contentLength} / ${CONTENT_MAX} 字`;

  const hintClass =
    contentLength >= CONTENT_MAX
      ? " is-full"
      : contentLength >= CONTENT_NEAR
        ? " is-near"
        : "";

  const inkClass =
    contentLength >= CONTENT_MAX
      ? " is-full"
      : contentLength >= CONTENT_NEAR
        ? " is-near"
        : "";

  return (
    <form
      className="p-form p-form--contact"
      noValidate
      onSubmit={handleSubmit}
      ref={formRef}
      aria-busy={status === "submitting"}
    >
      <label>
        姓名
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          aria-invalid={Boolean(errors.name)}
          aria-describedby="contact-error-name"
          onBlur={handleBlur}
          onChange={() => {
            clearError("name");
            dismissStatus();
          }}
        />
        <span
          className="p-form__field-error"
          id="contact-error-name"
          hidden={!errors.name}
        >
          {errors.name}
        </span>
      </label>
      <label>
        邮箱
        <input
          type="email"
          name="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby="contact-error-email"
          onBlur={handleBlur}
          onChange={() => {
            clearError("email");
            dismissStatus();
          }}
        />
        <span
          className="p-form__field-error"
          id="contact-error-email"
          hidden={!errors.email}
        >
          {errors.email}
        </span>
      </label>
      <label>
        主题
        <input
          type="text"
          name="subject"
          required
          maxLength={200}
          aria-invalid={Boolean(errors.subject)}
          aria-describedby="contact-error-subject"
          onBlur={handleBlur}
          onChange={() => {
            clearError("subject");
            dismissStatus();
          }}
        />
        <span
          className="p-form__field-error"
          id="contact-error-subject"
          hidden={!errors.subject}
        >
          {errors.subject}
        </span>
      </label>
      <label>
        消息
        <textarea
          name="content"
          required
          minLength={CONTENT_MIN}
          maxLength={CONTENT_MAX}
          aria-invalid={Boolean(errors.content)}
          aria-describedby="contact-error-content contact-hint-content"
          onBlur={handleBlur}
          onChange={(event) => {
            const node = event.target;
            if (
              !event.nativeEvent.isComposing &&
              node.value.length > CONTENT_MAX
            ) {
              node.value = node.value.slice(0, CONTENT_MAX);
            }
            clearError("content");
            dismissStatus();
            syncContent(node.value);
          }}
          onCompositionEnd={(event) => {
            const node = event.currentTarget;
            if (node.value.length > CONTENT_MAX) {
              node.value = node.value.slice(0, CONTENT_MAX);
            }
            syncContent(node.value);
          }}
        />
        <span
          className="p-form__field-error"
          id="contact-error-content"
          hidden={!errors.content}
        >
          {errors.content}
        </span>
        <span
          className={`p-form__field-hint${hintClass}`}
          id="contact-hint-content"
          hidden={!hintText}
        >
          {hintText}
        </span>
        <span
          className={`p-form__ink${inkClass}`}
          hidden={contentLength === 0}
          aria-hidden="true"
        >
          <i
            style={{
              width: `${Math.min(100, (contentLength / CONTENT_MAX) * 100)}%`,
            }}
          />
        </span>
      </label>
      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "发送中…" : "发送"}
      </button>
      <p
        className={`p-form__status${
          status === "ok"
            ? " is-ok"
            : status === "submitting"
              ? " is-pending"
              : status === "error" || status === "unavailable" || status === "busy"
                ? " is-error"
                : ""
        }`}
        role={
          status === "error" || status === "unavailable" || status === "busy"
            ? "alert"
            : "status"
        }
        hidden={status === "idle"}
      >
        {statusMessage}
      </p>
    </form>
  );
}
