function mostFrequent(entries, field) {
  const counts = new Map();

  for (const entry of entries) {
    const value = entry[field];
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let winner = "";
  let max = 0;
  for (const [value, count] of counts.entries()) {
    if (count > max) {
      winner = value;
      max = count;
    }
  }

  return winner || "Keine Einträge";
}

function toMinutes(time) {
  if (!time) {
    return null;
  }
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isNightTime(time) {
  const minutes = toMinutes(time);
  return minutes !== null && (minutes >= 22 * 60 || minutes < 6 * 60);
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

function isNightEntry(entry) {
  const start = toMinutes(entry.beginn_uhrzeit);
  const end = toMinutes(entry.ende_uhrzeit);

  if (start === null) {
    return false;
  }

  if (end === null || end === start) {
    return isNightTime(entry.beginn_uhrzeit);
  }

  const normalizedEnd = end < start ? end + 24 * 60 : end;
  const nightWindows = [
    [0, 6 * 60],
    [22 * 60, 30 * 60]
  ];

  return nightWindows.some(([nightStart, nightEnd]) => overlaps(start, normalizedEnd, nightStart, nightEnd));
}

function summarize(entries) {
  return {
    total: entries.length,
    geweckt: entries.filter((entry) => entry.auswirkung === "geweckt").length,
    nachts: entries.filter(isNightEntry).length,
    haeufigste_laermart: mostFrequent(entries, "laermart"),
    haeufigster_wahrnehmungsort: mostFrequent(entries, "wahrnehmungsort")
  };
}

module.exports = {
  summarize,
  isNightTime,
  isNightEntry
};
