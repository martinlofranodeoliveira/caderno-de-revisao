// The UI calls this only with an already validated engine state.
// One pass; no cloning, serializing, date parsing or per-deck revalidation.
export function summarizeNotebook(notebook, today) {
  const dueCounts = Object.create(null);
  const boxCounts = Object.create(null);
  let totalCards = 0;
  for (const deck of notebook.decks) {
    let due = 0;
    const boxes = [0, 0, 0, 0, 0];
    for (const card of deck.cards) {
      if (card.due <= today) due += 1;
      boxes[card.box - 1] += 1;
      totalCards += 1;
    }
    dueCounts[deck.id] = due;
    boxCounts[deck.id] = boxes;
  }
  return { dueCounts, boxCounts, totalCards };
}
