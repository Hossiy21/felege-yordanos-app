/**
 * Validation of a pre-member's details, shared by admin registration and
 * editing, the pre-member's own profile and self-registration (/join).
 */
import { z } from 'zod';

const NAME_MAX = 60;

const nameField = (label: string) =>
  z
    .string()
    .trim()
    .overwrite((v) => v.replace(/\s+/g, ' '))
    .min(1, `${label} is required.`)
    .max(NAME_MAX, `${label} must be at most ${NAME_MAX} characters.`);

/** Spaces, dashes and brackets are dropped; 9–15 digits, optional "+". */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-().]/g, ''))
  .refine((v) => /^\+?\d{9,15}$/.test(v), 'Enter a valid phone number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Enter a valid email address.')
  .pipe(z.email('Enter a valid email address.'));

/** Empty = not given (null). */
const blankToNull = z
  .string()
  .trim()
  .transform((v) => v || null);

const names = {
  name: nameField('Name'),
  fatherName: nameField("Father's name"),
  grandfatherName: nameField("Grandfather's name"),
};

/** All five fields required (self-registration, the pre-member's profile). */
export const preMemberDetailsSchema = z.object({
  ...names,
  email: emailSchema,
  phone: phoneSchema,
});

/** Admin registration: email and phone optional (walk-ins without them). */
export const adminPreMemberSchema = z.object({
  ...names,
  email: blankToNull.pipe(emailSchema.nullable()),
  phone: blankToNull.pipe(phoneSchema.nullable()),
});

export type PreMemberDetailsInput = z.input<typeof adminPreMemberSchema>;
export type PreMemberDetails = z.output<typeof adminPreMemberSchema>;

/** The editable fields, in display order (history and forms). */
export const PRE_MEMBER_FIELDS = [
  'name',
  'fatherName',
  'grandfatherName',
  'email',
  'phone',
] as const;
export type PreMemberField = (typeof PRE_MEMBER_FIELDS)[number];

export const PRE_MEMBER_FIELD_LABEL: Record<PreMemberField, string> = {
  name: 'Name',
  fatherName: "Father's name",
  grandfatherName: "Grandfather's name",
  email: 'Email',
  phone: 'Phone',
};

/** Changed fields, old -> new (for the 'edited' history entry). */
export function diffDetails(
  before: Record<PreMemberField, string | null>,
  after: Record<PreMemberField, string | null>,
): Partial<Record<PreMemberField, { from: string | null; to: string | null }>> {
  const changes: Partial<
    Record<PreMemberField, { from: string | null; to: string | null }>
  > = {};
  for (const f of PRE_MEMBER_FIELDS)
    if ((before[f] ?? null) !== (after[f] ?? null))
      changes[f] = { from: before[f] ?? null, to: after[f] ?? null };
  return changes;
}
