// Auth layout — no sidebar or topbar, centered card on a slate background.

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-teal">
            <span className="font-display text-white text-xl font-bold">B</span>
          </div>
          <div>
            <p className="font-display text-white text-xl leading-none">BlockLand</p>
            <p className="text-sidebar-muted text-xs mt-0.5">Zimbabwe Land Registry</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-modal p-8">
          {children}
        </div>

        <p className="text-center text-sidebar-muted text-xs mt-6">
          Secured by the Stacks blockchain · Clarity smart contracts
        </p>
      </div>
    </div>
  );
}
