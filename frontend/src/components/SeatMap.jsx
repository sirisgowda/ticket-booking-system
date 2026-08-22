export default function SeatMap({ seats, selected, onToggle }) {
  const rows = {};
  seats.forEach((s) => {
    rows[s.row] = rows[s.row] || [];
    rows[s.row].push(s);
  });

  return (
    <div className="seat-map">
      <div className="legend">
        <span><span className="dot" style={{ background: '#1a1e27', border: '1px solid #333' }} /> Available</span>
        <span><span className="dot" style={{ background: '#38bdf8' }} /> Selected</span>
        <span><span className="dot" style={{ background: '#facc15' }} /> Held</span>
        <span><span className="dot" style={{ background: '#4b5563' }} /> Booked</span>
      </div>
      <div style={{ marginBottom: 12, fontSize: 13, opacity: 0.8 }}>SCREEN / STAGE THIS WAY</div>
      {Object.keys(rows)
        .sort()
        .map((row) => (
          <div className="seat-row" key={row}>
            {rows[row]
              .sort((a, b) => a.number - b.number)
              .map((seat) => {
                const isSelected = selected.includes(seat.showSeatId);
                const cls =
                  seat.status === 'booked'
                    ? 'booked'
                    : seat.status === 'held' && !seat.mine
                    ? 'held'
                    : isSelected
                    ? 'selected'
                    : 'available';
                const clickable = seat.status === 'available' || (seat.status === 'held' && seat.mine);
                return (
                  <div
                    key={seat.showSeatId}
                    className={`seat ${cls}`}
                    title={`${seat.label} - ${seat.category} - ₹${seat.price}`}
                    onClick={() => clickable && onToggle(seat)}
                  >
                    {seat.label}
                  </div>
                );
              })}
          </div>
        ))}
    </div>
  );
}
