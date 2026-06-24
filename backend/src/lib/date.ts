export function getTodayJstDateKey(): string {
  const now = new Date();

  const jstDate = new Date(
    now.toLocaleString("en-US", {
      timeZone: "Asia/Tokyo",
    })
  );

  const year = jstDate.getFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, "0");
  const day = String(jstDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}