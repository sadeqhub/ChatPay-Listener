export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 480 }}>
      <h1>ChatPay Listener</h1>
      <p>Wayl Instagram inbound webhooks → Postgres + BullMQ.</p>
      <ul>
        <li>
          <code>GET /webhooks/instagram</code> — Meta verification
        </li>
        <li>
          <code>POST /webhooks/instagram</code> — inbound messages
        </li>
        <li>
          <code>GET /health</code> — liveness
        </li>
      </ul>
    </main>
  );
}
