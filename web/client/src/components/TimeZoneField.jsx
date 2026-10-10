import { Field } from "./Form.jsx";

// Same list as TIME_ZONES in server/prompts.mjs.
const ZONES = [
  ["Asia/Ho_Chi_Minh", "Việt Nam"],
  ["America/New_York", "Mỹ: miền Đông (New York, Florida)"],
  ["America/Chicago", "Mỹ: miền Trung (Texas, Chicago)"],
  ["America/Denver", "Mỹ: miền Núi (Colorado, Arizona)"],
  ["America/Los_Angeles", "Mỹ: miền Tây (California, Washington)"],
];

/** Where the page posts from: posting hours in the report are shown in this local time. */
export default function TimeZoneField({ value, onChange }) {
  return (
    <Field label="Kênh ở đâu?" hint="Giờ đăng trong báo cáo tính theo giờ địa phương của kênh.">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {ZONES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
      </select>
    </Field>
  );
}
