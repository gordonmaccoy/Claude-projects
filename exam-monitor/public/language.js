(() => {
  const key = 'examio-language';
  let language = 'en';
  const translatedText=new Map(),translatedAttributes=new Map();
  const korean = window.examioKorean;
  function t(message, values = {}) {
    if (typeof message !== 'string') return '';
    const template = language === 'ko' && Object.hasOwn(korean, message) ? korean[message] : message;
    return template.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? values[name] : match);
  }
  function apply(value) {
    language = value === 'ko' ? 'ko' : 'en';
    document.documentElement.lang = language;
    for(const [node,original]of translatedText){if(node.isConnected)node.data=original;}translatedText.clear();
    for(const [element,attributes]of translatedAttributes){if(element.isConnected)for(const [attribute,original]of attributes)element.setAttribute(attribute,original);}translatedAttributes.clear();
    if (language === 'en') return;
    // Translate the shipped HTML before application code inserts user content.
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode());) {
      if (node.parentElement.closest('script, style, textarea, [data-language-switch]')) continue;
      const text = node.data.trim();
      if (Object.hasOwn(korean, text)){translatedText.set(node,node.data);node.data = node.data.replace(text, () => t(text));}
    }
    for (const element of document.querySelectorAll('[aria-label], [title], [alt], [placeholder], meta[name="description"]')) {
      for (const attribute of ['aria-label', 'title', 'alt', 'placeholder', 'content']) {
        if (element.hasAttribute(attribute)){const original=element.getAttribute(attribute);if(Object.hasOwn(korean,original)){if(!translatedAttributes.has(element))translatedAttributes.set(element,new Map());translatedAttributes.get(element).set(attribute,original);element.setAttribute(attribute,t(original));}}
      }
    }
  }
  function setup() {
    let preference;
    try { preference = localStorage.getItem(key); } catch {}
    apply(preference ?? (navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en'));
    const control = document.querySelector('[data-language-switch]');
    if (control) {
      control.value = language;
      control.onchange = () => {
        try { localStorage.setItem(key, control.value); } catch { return; }
        location.reload();
      };
    }
  }
  window.examioLanguage = { t, apply, setup, get current() { return language; } };
})();
