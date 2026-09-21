interface XWidgets {
  widgets: {
    createTweet(
      id: string,
      container: HTMLElement,
      options: {
        theme: string;
        lang: string;
        dnt: boolean;
        conversation: string;
      }
    ): Promise<HTMLElement | undefined>;
  };
}

let widgetsPromise: Promise<XWidgets> | undefined;

export function loadXWidgets(): Promise<XWidgets> {
  if (widgetsPromise) {
    return widgetsPromise;
  }
  widgetsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;
    script.onload = () => {
      const api = (window as Window & { twttr?: XWidgets }).twttr;
      if (api?.widgets) {
        resolve(api);
      } else {
        reject(new Error("X widgets unavailable"));
      }
    };
    script.onerror = () => {
      reject(new Error("X widgets could not load"));
    };
    document.head.append(script);
  });
  return widgetsPromise;
}
