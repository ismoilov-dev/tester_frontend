/** Premium toj ikonkasi — butun loyihada yagona */
export default function Crown({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
      <rect x="5" y="19.5" width="14" height="2" rx="1" />
    </svg>
  );
}
