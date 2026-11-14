import { motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EmbeddedTweet } from "react-tweet";
import type { Tweet } from "react-tweet/api";
import { communityTweets } from "../../data/community-tweets";
import { COMMUNITY_SECTION_INDEX } from "../../data/section-routes";
import { SPRING } from "../theme/constants";
import "../../styles/community-timeline.css";

const EMPTY_CARDS = [0, 1, 2, 3];
const tweets = communityTweets;

function subscribeToPageLoad(onChange: () => void): () => void {
  window.addEventListener("load", onChange);
  return () => window.removeEventListener("load", onChange);
}

function isPageLoaded(): boolean {
  return document.readyState === "complete";
}

function TweetReel({
  posts,
  reverse,
  label,
}: {
  posts: Tweet[];
  reverse?: boolean;
  label: string;
}) {
  // Repeat short collections to fill tall screens without an empty seam.
  const sequence =
    posts.length > 0
      ? Array.from(
          { length: Math.max(1, Math.ceil(2 / posts.length)) },
          (_, repeat) =>
            posts.map((post) => ({ post, key: `${repeat}-${post.id_str}` }))
        ).flat()
      : [];
  const cards =
    sequence.length > 0
      ? sequence.map(({ post, key }) => (
          <div className="reel-embed" key={key}>
            <EmbeddedTweet tweet={post} />
          </div>
        ))
      : EMPTY_CARDS.map((id) => (
          <div
            aria-hidden="true"
            className="reel-tweet reel-placeholder"
            key={id}
          >
            <div className="reel-author">
              <span className="reel-avatar" />
              <span className="reel-ghost-name" />
              <span>𝕏</span>
            </div>
            <div className="reel-ghost-lines">
              <span />
              <span />
              <span />
            </div>
            <span className="reel-pending-label">TWEET PENDIENTE</span>
          </div>
        ));
  return (
    <section
      aria-label={label}
      className={`tweet-reel ${reverse ? "tweet-reel-reverse" : ""}`}
    >
      <div className="reel-label">
        <span>{label}</span>
        <span aria-hidden="true">𝕏</span>
      </div>
      <div className="reel-viewport">
        <div
          className="reel-track"
          style={{
            animationDuration: `${Math.max(48, sequence.length * 20)}s`,
          }}
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

export function CommunityTimeline({
  section,
  onNext,
  onPrevious,
  reducedMotion,
}: {
  section: number;
  onNext: () => void;
  onPrevious: () => void;
  reducedMotion: boolean;
}) {
  const isActive = section === COMMUNITY_SECTION_INDEX;
  // Tweet images would otherwise compete with the visible page's own loading.
  const reelsReady =
    useSyncExternalStore(subscribeToPageLoad, isPageLoaded, () => false) ||
    isActive;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hidden, setHidden] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const leftPosts = tweets.filter((_, index) => index % 2 === 0);
  const rightPosts =
    tweets.length > 1 ? tweets.filter((_, index) => index % 2 === 1) : tweets;

  useEffect(() => {
    const video = videoRef.current;
    if (!(video && isActive)) {
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
      setHidden(document.hidden);
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
  }, [reducedMotion, isActive]);

  return (
    <motion.section
      animate={
        isActive
          ? { opacity: 1, visibility: "visible", y: "0%" }
          : {
              opacity: reducedMotion ? 0 : 1,
              // Park the panel on the side the visitor scrolled away from, so
              // it leaves and returns in the same direction as the mosaic.
              y: reducedMotion
                ? "0%"
                : `${section < COMMUNITY_SECTION_INDEX ? 100 : -100}%`,
              transitionEnd: { visibility: "hidden" },
            }
      }
      aria-hidden={!isActive}
      aria-labelledby="cinema-heading"
      className="recap-cinema"
      data-hidden={hidden || !isActive}
      data-paused={reducedMotion}
      data-theme="light"
      inert={!isActive}
      initial={false}
      style={{ pointerEvents: isActive ? "auto" : "none" }}
      transition={reducedMotion ? { duration: 0.2, type: "tween" } : SPRING}
    >
      <TweetReel
        label="VUESTRAS HISTORIAS"
        posts={reelsReady ? leftPosts : []}
      />
      <div className="cinema-center">
        <header className="cinema-heading">
          <span>MADRID · 18—20 SEPTIEMBRE 2026</span>
          <h2 id="cinema-heading">
            ASÍ FUE <br />
            <em>HACKSPAIN.</em>
          </h2>
        </header>
        <div className="cinema-screen">
          <video
            aria-label="Vídeo de HackSpain 2026"
            autoPlay={isActive && !reducedMotion}
            controls
            loop
            muted
            onPlay={() => setBlocked(false)}
            playsInline
            poster="/recap/poster.jpg"
            preload="metadata"
            ref={videoRef}
          >
            <source src="/recap/hackspain-2026.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="cinema-note">
          {tweets.length === 0 && (
            <span>Tweets de la comunidad · Próximamente</span>
          )}
          {blocked && (
            <span role="status">Pulsa play en el vídeo para reproducirlo.</span>
          )}
        </div>
      </div>
      <TweetReel
        label="LO QUE NOS LLEVAMOS"
        posts={reelsReady ? rightPosts : []}
        reverse
      />
      <nav aria-label="Secciones de HackSpain" className="cinema-nav">
        <button onClick={onPrevious} type="button">
          ↑ Volver al inicio
        </button>
        <span>GRACIAS POR HACERLO POSIBLE.</span>
        <button onClick={onNext} type="button">
          La misión →
        </button>
      </nav>
    </motion.section>
  );
}
