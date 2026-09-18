export default function StarRating({ rating = 0, size = 'sm' }) {
  const full = Math.round(rating);
  return (
    <span className={`stars stars--${size}`} aria-label={`Rating ${rating} dari 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? '' : 'star-empty'}>
          ★
        </span>
      ))}
    </span>
  );
}
