(function () {
  function protectImages(root) {
    root.querySelectorAll('img').forEach((img) => {
      img.setAttribute('draggable', 'false');
      img.style.userSelect = 'none';
      img.style.webkitUserSelect = 'none';
      img.style.webkitUserDrag = 'none';
    });
  }

  document.addEventListener('contextmenu', (event) => {
    if (event.target.closest('img')) {
      event.preventDefault();
    }
  });

  document.addEventListener('dragstart', (event) => {
    if (event.target.closest('img')) {
      event.preventDefault();
    }
  });

  document.addEventListener('copy', (event) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const node = selection.getRangeAt(0).commonAncestorContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      if (el && (el.tagName === 'IMG' || el.querySelector?.('img'))) {
        event.preventDefault();
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
    }
  });

  protectImages(document);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') {
          node.setAttribute('draggable', 'false');
          node.style.userSelect = 'none';
          node.style.webkitUserSelect = 'none';
          node.style.webkitUserDrag = 'none';
        } else {
          protectImages(node);
        }
      });
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
