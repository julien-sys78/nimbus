/* =========================================================
   NIMBUS — démarrage
   ========================================================= */
(() => {
  OS.renderDock();
  OS.renderDesktop();
  OS.emit('ready');

  OS.boot(() => {
    const first = !OS.store.get('welcomed', false);
    setTimeout(() => {
      OS.notify({
        title: first ? 'Bienvenue sur Nimbus' : 'Bon retour sur Nimbus',
        body: first ? 'Double-cliquez sur « Lisez-moi » pour découvrir la démo, ou ouvrez la recherche avec ⌘K.' : 'Vos fichiers et réglages ont été restaurés.',
        timeout: 7000,
        onClick: () => OS.openPath('/Bureau/Lisez-moi.txt'),
      });
      OS.store.set('welcomed', true);
    }, 400);
  });
})();
