import PropTypes from "prop-types";

export default function GradientCard({ label, value, gradient }) {
const gradientMap = {
    purple: "linear-gradient(to right, #60a5fa, #2563eb)",
    blue: "linear-gradient(to right, #2563eb, #1d4ed8)",
    pink: "linear-gradient(to right, #ef4444, #dc2626)",
    green: "linear-gradient(to right, #10b981, #059669)",
};

return (
    <div
    style={{
        background: gradientMap[gradient] || gradientMap.purple,
    }}
    className="p-4 rounded-xl text-center shadow text-white"
    >
    <p className="text-sm">{label}</p>
    <h2 className="text-2xl font-bold">{value}</h2>
    </div>
);
}

// ✅ PropTypes validation
GradientCard.propTypes = {
label: PropTypes.string.isRequired, // descriptive label, must be string
value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number,
  ]).isRequired, // supports both numbers and text
  gradient: PropTypes.oneOf(["purple", "blue", "pink", "green"]), // restrict to known gradient names
};
