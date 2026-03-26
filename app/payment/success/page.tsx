export default function PaymentSuccess() {
  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">✅</div>
        <h1 className="text-3xl font-extrabold text-white mb-3">Payment Received</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
          Your crypto payment is being confirmed on-chain. Once confirmed (usually within a few minutes),
          your license key will be issued and sent to your Discord DM or email.
        </p>
        <p className="text-zinc-500 text-xs mb-8">
          If you haven&apos;t received your key within 30 minutes, open a ticket in our Discord.
        </p>
        <a
          href="https://discord.gg/Prr7FuvBJc"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-8 py-3 text-sm font-semibold text-white hover:bg-indigo-500 transition"
        >
          Open Discord
        </a>
      </div>
    </div>
  );
}
