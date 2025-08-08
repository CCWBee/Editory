export function initUI(onGenerate) {
  document.getElementById('btnGenerate').onclick = onGenerate;
  document.getElementById('btnResetView').onclick = () => {
    // emit event for main.js to handle camera reset if needed
    location.reload();
  };
}
