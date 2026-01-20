import PropTypes from "prop-types";

export default function Button({
children,
onClick,
variant = "primary",
className = "",
...props
}) {
const base =
    "px-4 py-2 rounded-md font-medium transition-all duration-200 focus:outline-none";

const styles = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-800 hover:bg-gray-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
};

return (
    <button
    onClick={onClick}
    className={`${base} ${styles[variant] || styles.primary} ${className}`}
    {...props}
    >
    {children}
    </button>
);
}

// ✅ PropTypes validation
Button.propTypes = {
  children: PropTypes.node.isRequired,          // anything renderable
  onClick: PropTypes.func,                      // optional click handler
  variant: PropTypes.oneOf(["primary", "secondary", "danger"]), // restrict to known variants
  className: PropTypes.string,                  // optional custom class
};
