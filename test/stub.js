(function () {
  const store = {};
  const mkDoc = id => ({ id, data: () => JSON.parse(JSON.stringify(store[id])) });
  const col = {
    limit() { return col; },
    async get() { return { docs: Object.keys(store).map(mkDoc) }; },
    doc(id) { return { async set(v) { store[id] = JSON.parse(JSON.stringify(v)); }, async delete() { delete store[id]; } }; },
  };
  window.claude = { use: async name => {
    if (name === 'user') return { id: async () => 'u1' };
    if (name === 'db') return { collection: () => col };
    if (name === 'sample') return { json: async () => ({ questions: [], areas: [], diet: [], calorie_adjust: 0, coach_note: 'Stub note.' }) };
    return null;
  } };
  window.__store = store;
})();
