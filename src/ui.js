export function wireUI({ onGenerate, onReseed, onFrame, onSave, onRestore, onParam }) {
  const $ = (id) => document.getElementById(id);

  // basic button wiring
  $('btnGenerate')?.addEventListener('click', onGenerate);
  $('btnReseed')?.addEventListener('click', onReseed);
  $('btnFrame')?.addEventListener('click', onFrame);
  $('btnSave')?.addEventListener('click', onSave);

  // hook up range/select inputs so they forward their values
  const inputs = document.querySelectorAll('#ui input, #ui select');
  inputs.forEach((el) => {
    el.addEventListener('change', (e) => {
      const target = e.target;
      onParam?.(target.id, target.value);
    });
  });

  // simple drag-and-drop loader for JSON save files
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        onRestore?.(data);
      } catch (err) {
        console.error('Invalid save JSON', err);
      }
    };
    reader.readAsText(file);
  });
}
