import { Avatar } from "@/components/klasemen/avatar";
import type { Award } from "@/lib/klasemen-awards";

export function AwardsBoard({ awards }: { awards: Award[] }) {
  const given = awards.filter((a) => a.holders.length > 0).length;
  return (
    <section className="kl-awards" aria-label="Papan gelar">
      <div className="kl-awards-head">
        <div>
          <h2 className="kl-card-title">
            <span aria-hidden="true">🏅</span> Papan Gelar
          </h2>
          <p className="kl-card-sub">
            Peringkat utama hanya satu, tapi gelar ada banyak. {given} dari {awards.length} gelar sudah punya pemilik.
          </p>
        </div>
      </div>
      <div className="kl-awards-grid">
        {awards.map((a) => (
          <article
            key={a.key}
            className={`kl-award ${a.key === "juara" ? "kl-award--gold" : ""} ${a.holders.length === 0 ? "is-empty" : ""}`}
          >
            <div className="kl-award-top">
              <span className="kl-award-emoji" aria-hidden="true">
                {a.emoji}
              </span>
              <div>
                <h3>{a.title}</h3>
                <small>{a.rule}</small>
              </div>
            </div>
            <div className="kl-award-body">
              <div className="kl-award-who">
                {a.holders.length > 0 && (
                  <span className="kl-award-avatars">
                    {a.holders.slice(0, 2).map((name) => (
                      <Avatar key={name} name={name} />
                    ))}
                  </span>
                )}
                <strong>{a.holders.length > 0 ? a.holders.join(" & ") : "—"}</strong>
              </div>
              <div className="kl-award-val">
                <b>{a.value}</b>
                {a.unit && <span>{a.unit}</span>}
              </div>
            </div>
            <p>{a.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
