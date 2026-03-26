export default function PaymentCancel() {
  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">❌</div>
        <h1 className="text-3xl font-extrabold text-white mb-3">Payment Cancelled</h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          Your payment was cancelled. No funds were taken. You can try again anytime.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-full bg-zinc-800 border border-zinc-700 px-8 py-3 text-sm font-semibold text-white hover:bg-zinc-700 transition"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
