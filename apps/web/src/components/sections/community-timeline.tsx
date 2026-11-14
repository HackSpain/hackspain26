import { useReducedMotion } from "motion/react";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";
import { EmbeddedTweet } from "react-tweet";
import { communityTweets } from "../../data/community-tweets";
import "../../styles/community-timeline.css";

type TweetComponents = NonNullable<
  ComponentProps<typeof EmbeddedTweet>["components"]
>;
type MediaImgProps = Parameters<NonNullable<TweetComponents["MediaImg"]>>[0];

/** Reel columns are under 300px wide; X's "small" photos are about 680px JPEGs. */
function ReelMediaImg({ alt, src, ...props }: MediaImgProps) {
  const url = new URL(src);
  url.searchParams.set("format", "webp");
  url.searchParams.set("name", "360x360");
  return (
    <img
      alt={alt}
      decoding="async"
      height={360}
      loading="lazy"
      src={url.toString()}
      width={360}
      {...props}
    />
  );
}

const TWEET_COMPONENTS: TweetComponents = { MediaImg: ReelMediaImg };

const REELS = {
  left: {
    label: "VUESTRAS HISTORIAS",
    posts: communityTweets.filter((_, index) => index % 2 === 0),
  },
  right: {
    label: "LO QUE NOS LLEVAMOS",
    posts: communityTweets.filter((_, index) => index % 2 === 1),
  },
};

export function CommunityReel({ side }: { side: keyof typeof REELS }) {
  const { label, posts } = REELS[side];
  const cards = posts.map((post) => (
    <div className="reel-embed" key={post.id_str}>
      <EmbeddedTweet components={TWEET_COMPONENTS} tweet={post} />
    </div>
  ));
  return (
    <section
      aria-label={label}
      className={`tweet-reel ${side === "right" ? "tweet-reel-reverse" : ""}`}
      data-theme="light"
    >
      <div className="reel-label">
        <span>{label}</span>
        <span aria-hidden="true">𝕏</span>
      </div>
      <div className="reel-viewport">
        <div
          className="reel-track"
          style={{ animationDuration: `${Math.max(48, posts.length * 20)}s` }}
        >
          <div className="reel-set">{cards}</div>
          <div aria-hidden="true" className="reel-set reel-copy" inert>
            {cards}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CommunityHeading() {
  return (
    <header className="cinema-heading">
      <span>MADRID · 18—20 SEPTIEMBRE 2026</span>
      <h2>
        ASÍ FUE <em>HACKSPAIN.</em>
      </h2>
    </header>
  );
}

export function CommunityVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    let active = true;
    let resume = false;
    const play = async () => {
      try {
        await video.play();
      } catch (error) {
        if (
          !active ||
          (error instanceof DOMException && error.name === "AbortError")
        ) {
          return;
        }
        // A direct visit may disallow audio; keep autoplay working silently.
        if (!video.muted) {
          video.muted = true;
          try {
            await video.play();
            return;
          } catch {
            if (!active) {
              return;
            }
          }
        }
        setBlocked(true);
      }
    };
    if (!(reducedMotion || document.hidden)) {
      video.muted = false;
      play();
    }
    const onVisibility = () => {
      if (document.hidden) {
        resume = !video.paused;
        video.pause();
      } else if (resume) {
        play();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      video.pause();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [reducedMotion]);

  return (
    <div className="cinema-screen">
      <video
        aria-label="Vídeo de HackSpain 2026"
        controls
        loop
        muted
        onPlay={() => setBlocked(false)}
        playsInline
        poster="/recap/poster.webp"
        preload="metadata"
        ref={videoRef}
      >
        <source src="/recap/hackspain-2026.mp4" type="video/mp4" />
      </video>
      {blocked && (
        <span className="cinema-note" role="status">
          Pulsa play en el vídeo para reproducirlo.
        </span>
      )}
    </div>
  );
}
