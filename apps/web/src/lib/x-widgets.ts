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
    script.addEventListener(
      "load",
      () => {
        const api = (window as Window & { twttr?: XWidgets }).twttr;
        if (api?.widgets) {
          resolve(api);
        } else {
          reject(new Error("X widgets unavailable"));
        }
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("X widgets could not load"));
      },
      { once: true }
    );
    document.head.append(script);
  });
  return widgetsPromise;
}
