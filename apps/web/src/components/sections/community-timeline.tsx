import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { type CommunityPost, communityPosts } from "../../data/recap";
import { loadXWidgets } from "../../lib/x-widgets";
import "../../styles/community-timeline.css";

const EMPTY_CARDS = [0, 1, 2, 3];

function TweetCard({ post, allowX }: { post: CommunityPost; allowX: boolean }) {
  const frameRef = useRef<HTMLElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [width, setWidth] = useState(250);
  const scale = Math.min(1, width / 250);
  let fallbackLabel = "Publicación de X sin cargar";
  if (allowX) {
    fallbackLabel = failed ? "Ver publicación original" : "Cargando publicación de X…";
  }

  useEffect(() => {
    if (!allowX) {
      return;
    }
    const frame = frameRef.current;
    const container = embedRef.current;
    if (!(frame && container)) {
      return;
    }
    let active = true;
    const observer = new ResizeObserver(() => {
      if (frame.clientWidth > 0) {
        setWidth(frame.clientWidth);
      }
    });
    observer.observe(frame);
    // Each effect owns its target, so late widget responses cannot duplicate it.
    const target = document.createElement("div");
    container.append(target);
    const timeout = window.setTimeout(() => {
      if (active) {
        setFailed(true);
      }
    }, 20_000);
    loadXWidgets()
      .then((api) => {
        if (!active) {
          return;
        }
        return api.widgets.createTweet(
          post.url.split("/").at(-1) ?? "",
          target,
          {
            theme: "light",
            lang: "es",
            dnt: true,
            conversation: "none",
          }
        );
      })
      .then((element) => {
        if (active) {
          window.clearTimeout(timeout);
          setLoaded(Boolean(element));
          setFailed(!element);
        }
      })
      .catch(() => {
        if (active) {
          window.clearTimeout(timeout);
          setFailed(true);
        }
      });
    return () => {
      active = false;
      window.clearTimeout(timeout);
      observer.disconnect();
      target.remove();
    };
  }, [allowX, post.url]);

  return (
    <article className="reel-embed" ref={frameRef}>
      <div
        className="reel-embed-content"
        ref={embedRef}
        style={{ width: Math.max(250, width), zoom: scale }}
      />
      {!loaded && (
        <div className="reel-embed-fallback">
          <span>
            {fallbackLabel}
          </span>
          <a href={post.url} rel="noopener noreferrer" target="_blank">
            {post.author} · @{post.handle} ↗
          </a>
        </div>
      )}
    </article>
  );
}

function TweetReel({
  posts,
  reverse,
  label,
  allowX,
}: {
  posts: CommunityPost[];
  reverse?: boolean;
  label: string;
  allowX: boolean;
}) {
  // Repeat short collections to fill tall screens without an empty seam.
  const sequence =
    posts.length > 0
      ? Array.from(
          { length: Math.max(1, Math.ceil(2 / posts.length)) },
          (_, repeat) =>
            posts.map((post) => ({ post, key: `${repeat}-${post.url}` }))
        ).flat()
      : [];
  const cards =
    sequence.length > 0
      ? sequence.map(({ post, key }) => (
          <TweetCard allowX={allowX} key={key} post={post} />
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
  isActive,
  onNext,
  onPrevious,
  reducedMotion,
}: {
  isActive: boolean;
  onNext: () => void;
  onPrevious: () => void;
  reducedMotion: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hidden, setHidden] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [allowX, setAllowX] = useState(false);
  const leftPosts = communityPosts.filter((_, index) => index % 2 === 0);
  const rightPosts =
    communityPosts.length > 1
      ? communityPosts.filter((_, index) => index % 2 === 1)
      : communityPosts;

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
      animate={{
        opacity: isActive ? 1 : 0,
        y: isActive || reducedMotion ? 0 : "100%",
      }}
      aria-hidden={!isActive}
      aria-labelledby="cinema-heading"
      className="recap-cinema"
      data-hidden={hidden || !isActive}
      data-paused={reducedMotion}
      inert={!isActive}
      initial={{ opacity: 0, y: reducedMotion ? 0 : "100%" }}
      style={{
        visibility: isActive ? "visible" : "hidden",
        pointerEvents: isActive ? "auto" : "none",
      }}
      transition={{
        duration: reducedMotion ? 0.15 : 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <TweetReel allowX={allowX} label="VUESTRAS HISTORIAS" posts={leftPosts} />
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
          {!allowX && communityPosts.length > 0 && (
            <button onClick={() => setAllowX(true)} type="button">
              Cargar publicaciones desde X
            </button>
          )}
          {communityPosts.length === 0 && (
            <span>Tweets de la comunidad · Próximamente</span>
          )}
          {blocked && (
            <span role="status">Pulsa play en el vídeo para reproducirlo.</span>
          )}
        </div>
      </div>
      <TweetReel allowX={allowX} label="LO QUE NOS LLEVAMOS" posts={rightPosts} reverse />
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
