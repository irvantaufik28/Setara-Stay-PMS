"use client";
import "../styles/housekeeping.css";
import { useEffect, useState } from "react";
import { AdminShell } from "../../../components/layout/AdminShell";
import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { restoreSession } from "../../../lib/auth";
import {
  getRoomNumberOptions,
  type RoomNumber,
} from "../../rooms/services/room-numbers";
import {
  listCleaningRooms,
  listRecentRoomStatusHistory,
  listRoomStatusHistory,
  markRoomReady,
  type RoomStatusEvent,
} from "../services/housekeeping";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

export function HousekeepingPage() {
  const { t } = useTranslations({ en, id });
  const [rooms, setRooms] = useState<RoomNumber[]>([]);
  const [types, setTypes] = useState<{ id: string; name: string }[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RoomNumber | null>(null);
  const [history, setHistory] = useState<RoomStatusEvent[]>([]);
  const [recentHistory, setRecentHistory] = useState<RoomStatusEvent[]>([]);
  const [historyError, setHistoryError] = useState(false);
  const [recentHistoryError, setRecentHistoryError] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void restoreSession().then((ok) => {
      if (!ok) return;
      return getRoomNumberOptions(controller.signal)
        .then(([roomTypes]) => {
          if (!controller.signal.aborted) setTypes(roomTypes.items);
        })
        .catch(() => {});
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    void restoreSession()
      .then((ok) => {
        if (!ok) return null;
        return listCleaningRooms(
          page,
          search.trim(),
          typeId,
          controller.signal,
        );
      })
      .then((result) => {
        if (!active || !result) return;
        setRooms(result.items);
        setTotal(result.total);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : t("loadError"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, search, typeId, refresh]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setHistoryLoading(true);
    setHistory([]);
    setHistoryError(false);
    void listRoomStatusHistory(selected.id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setHistory(result.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setHistoryError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => {
    const controller = new AbortController();
    setRecentHistoryError(false);
    void restoreSession()
      .then((ok) => {
        if (!ok) return null;
        return listRecentRoomStatusHistory(controller.signal);
      })
      .then((result) => {
        if (result && !controller.signal.aborted)
          setRecentHistory(result.items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRecentHistoryError(true);
      });
    return () => controller.abort();
  }, [refresh]);

  async function markReady() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await markRoomReady(selected);
      setSelected(null);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title={t("title")} context={t("title")}>
      <main className="housekeeping-page">
        <header className="housekeeping-heading">
          <div>
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </div>
          <strong>
            {total} {t("roomsToClean")}
          </strong>
        </header>
        <div className="housekeeping-filters">
          <input
            type="search"
            aria-label={t("search")}
            placeholder={t("search")}
            value={search}
            onChange={(event) => {
              setPage(1);
              setSearch(event.target.value);
            }}
          />
          <select
            aria-label={t("roomType")}
            value={typeId}
            onChange={(event) => {
              setPage(1);
              setTypeId(event.target.value);
            }}
          >
            <option value="">{t("allTypes")}</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="housekeeping-error" role="alert">
            {error}
          </p>
        )}
        {loading ? (
          <LoadingSkeleton variant="table" />
        ) : (
          <div className="housekeeping-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("room")}</th>
                  <th>{t("roomType")}</th>
                  <th>{t("floor")}</th>
                  <th>{t("status")}</th>
                  <th>{t("action")}</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      <strong>{room.roomNumber}</strong>
                    </td>
                    <td>{room.roomTypeName}</td>
                    <td>{room.floorName || "—"}</td>
                    <td>
                      <span className="housekeeping-status">
                        {t("cleaning")}
                      </span>
                    </td>
                    <td>
                      <button type="button" onClick={() => setSelected(room)}>
                        {t("viewAndMarkReady")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rooms.length && (
              <p className="housekeeping-empty">{t("empty")}</p>
            )}
          </div>
        )}
        {total > 20 && (
          <nav className="housekeeping-pagination">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
              {t("previous")}
            </button>
            <span>
              {page} / {Math.ceil(total / 20)}
            </span>
            <button
              disabled={page * 20 >= total}
              onClick={() => setPage(page + 1)}
            >
              {t("next")}
            </button>
          </nav>
        )}
        <section className="housekeeping-recent">
          <h2>{t("recentHistory")}</h2>
          {recentHistoryError ? (
            <p className="housekeeping-error" role="alert">
              {t("historyLoadError")}
            </p>
          ) : recentHistory.length ? (
            <div className="housekeeping-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("room")}</th>
                    <th>{t("status")}</th>
                    <th>{t("changedBy")}</th>
                    <th>{t("changedAt")}</th>
                    <th>{t("source")}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentHistory.map((event) => (
                    <tr key={event.id}>
                      <td>{event.roomNumber}</td>
                      <td>
                        {event.statusBefore} → {event.statusAfter}
                      </td>
                      <td>{event.actorName}</td>
                      <td>
                        {new Date(event.occurredAt).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        })}
                      </td>
                      <td>{event.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>{t("noHistory")}</p>
          )}
        </section>
        {selected && (
          <div
            className="housekeeping-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !saving)
                setSelected(null);
            }}
          >
            <section
              className="housekeeping-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="housekeeping-dialog-title"
            >
              <header>
                <div>
                  <small>{selected.roomTypeName}</small>
                  <h2 id="housekeeping-dialog-title">
                    {t("room")} {selected.roomNumber}
                  </h2>
                </div>
                <button
                  type="button"
                  aria-label={t("close")}
                  onClick={() => setSelected(null)}
                  disabled={saving}
                >
                  ×
                </button>
              </header>
              <p>{t("confirmDescription")}</p>
              {error && (
                <p className="housekeeping-error" role="alert">
                  {error}
                </p>
              )}
              <h3>{t("history")}</h3>
              {historyLoading ? (
                <p>{t("loadingHistory")}</p>
              ) : historyError ? (
                <p className="housekeeping-error" role="alert">
                  {t("historyLoadError")}
                </p>
              ) : history.length ? (
                <ul>
                  {history.map((event) => (
                    <li key={event.id}>
                      <strong>{event.actorName}</strong> · {event.statusBefore}{" "}
                      → {event.statusAfter}
                      <br />
                      <span>
                        {new Date(event.occurredAt).toLocaleString("id-ID", {
                          timeZone: "Asia/Jakarta",
                        })}{" "}
                        · {event.source}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{t("noHistory")}</p>
              )}
              <footer>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  disabled={saving}
                >
                  {t("cancel")}
                </button>
                <button type="button" onClick={markReady} disabled={saving}>
                  {saving ? t("saving") : t("markReady")}
                </button>
              </footer>
            </section>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
