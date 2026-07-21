import { useState } from "react";

type FieldName = "name" | "email" | "subject" | "content";
type FieldErrors = Partial<Record<FieldName, string>>;
type Status = "idle" | "submitting" | "ok" | "error";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Contact form island — posts a message to `/api/contact/messages`.
 *
 * Validation rules, error copy and status messages are ported from the
 * live dist bundle (`ContactForm.astro_astro_type_script_index_0_lang.*.js`)
 * and the `/contact` page markup.
 */
export default function ContactForm({
  fallbackEmail = "3992237161@qq.com",
}: {
  /** Address shown when the API call fails, so the user can still reach out. */
  fallbackEmail?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(values: Record<FieldName, string>): boolean {
    const next: FieldErrors = {};
    if (!values.name) next.name = "请填写姓名";
    if (values.email && !EMAIL_PATTERN.test(values.email)) {
      next.email = "邮箱格式不正确";
    }
    if (!values.subject) next.subject = "请填写主题";
    if (!values.content) {
      next.content = "请填写消息";
    } else if (values.content.length < 10) {
      next.content = "消息至少 10 个字";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const values: Record<FieldName, string> = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      subject: String(formData.get("subject") ?? "").trim(),
      content: String(formData.get("content") ?? "").trim(),
    };

    if (!validate(values)) return;

    setStatus("submitting");
    try {
      const response = await fetch("/api/contact/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("failed");
      setStatus("ok");
      form.reset();
      setErrors({});
    } catch {
      setStatus("error");
    }
  }

  return (
    <form className="p-form p-form--contact" noValidate onSubmit={handleSubmit}>
      <label>
        姓名
        <input type="text" name="name" required autoComplete="name" />
        <span className="p-form__field-error" hidden={!errors.name}>
          {errors.name}
        </span>
      </label>
      <label>
        邮箱
        <input type="email" name="email" autoComplete="email" />
        <span className="p-form__field-error" hidden={!errors.email}>
          {errors.email}
        </span>
      </label>
      <label>
        主题
        <input type="text" name="subject" required maxLength={200} />
        <span className="p-form__field-error" hidden={!errors.subject}>
          {errors.subject}
        </span>
      </label>
      <label>
        消息
        <textarea name="content" required minLength={10} />
        <span className="p-form__field-error" hidden={!errors.content}>
          {errors.content}
        </span>
      </label>
      <button type="submit" disabled={status === "submitting"}>
        发送
      </button>
      <p
        className={`p-form__status${
          status === "ok" ? " is-ok" : status === "error" ? " is-error" : ""
        }`}
        role={status === "error" ? "alert" : "status"}
        hidden={status === "idle"}
      >
        {status === "submitting"
          ? "发送中…"
          : status === "ok"
            ? "已收到，谢谢你的留言！"
            : status === "error"
              ? `发送失败，请直接邮件联系 ${fallbackEmail}`
              : ""}
      </p>
    </form>
  );
}
