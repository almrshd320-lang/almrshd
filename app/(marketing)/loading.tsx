/**
 * Skeleton for the storefront while server data resolves.
 *
 * Mirrors the real hero's geometry so the page does not jump when content
 * arrives — a skeleton whose shape differs from the content it replaces causes
 * more layout shift than no skeleton at all.
 */
export default function Loading() {
  return (
    <div className="shell py-12" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div className="order-2 space-y-5 lg:order-1">
          <div className="skeleton h-6 w-48" />
          <div className="skeleton h-16 w-full max-w-xl" />
          <div className="skeleton h-16 w-3/4 max-w-lg" />
          <div className="skeleton h-5 w-full max-w-md" />
          <div className="flex gap-3 pt-4">
            <div className="skeleton h-14 w-36" />
            <div className="skeleton h-14 w-36" />
          </div>
          <div className="flex gap-3 pt-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 w-20" />
            ))}
          </div>
        </div>

        <div className="order-1 flex justify-center lg:order-2">
          <div className="skeleton aspect-[9/19] w-52 rounded-3xl sm:w-72" />
        </div>
      </div>
    </div>
  );
}
