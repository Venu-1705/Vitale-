import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, ShoppingBag, IndianRupee, Image as ImageIcon, Loader2, AlertCircle, Info, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useStorefrontProducts, useMerchantOrders, useMerchantRevenue, useShopHome,
  useAdvanceOrder, useCreateProduct, rupeesFromPaise,
  type OrderStatus, type Order,
} from '@/lib/storefront';

const short = (id: string) => id.slice(0, 8);
const fmt = (s: string) => new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700', packed: 'bg-indigo-100 text-indigo-700',
  shipped: 'bg-violet-100 text-violet-700', delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500', refunded: 'bg-red-100 text-red-700',
};
// Fulfilment forward path (payment confirmation that moves pending→confirmed is D8-deferred).
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { confirmed: 'packed', packed: 'shipped', shipped: 'delivered' };

function OrderRow({ order }: { order: Order }) {
  const advance = useAdvanceOrder();
  const next = NEXT_STATUS[order.status];
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{short(order.id)}</TableCell>
      <TableCell className="font-mono text-xs">{short(order.userId)}</TableCell>
      <TableCell><Badge className={`text-xs border-0 capitalize ${STATUS_COLOR[order.status]}`}>{order.status}</Badge></TableCell>
      <TableCell className="text-sm font-medium">{rupeesFromPaise(order.totalPaise)}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{fmt(order.createdAt)}</TableCell>
      <TableCell className="text-right">
        {order.status === 'pending' ? (
          <span className="text-xs text-muted-foreground">Awaiting payment (D8)</span>
        ) : next ? (
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={advance.isPending}
            onClick={() => advance.mutate({ id: order.id, status: next }, { onSuccess: () => toast.success(`Marked ${next}`), onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not advance') })}>
            Mark {next}
          </Button>
        ) : <span className="text-xs text-muted-foreground">—</span>}
      </TableCell>
    </TableRow>
  );
}

/**
 * Storefront (D12, merchant side). The original mock was a marketing landing-page
 * builder (hero/sections/testimonials/FAQs/custom CSS) — none of which the backend
 * supports. D12 manages a real catalog + orders + revenue, so this is now the real
 * merchant console. The page-builder/testimonials/FAQ CMS is a documented gap.
 */
export default function Storefront() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const products = useStorefrontProducts(organizationId);
  const orders = useMerchantOrders(organizationId ? { organizationId } : {});
  const revenue = useMerchantRevenue(organizationId);
  const home = useShopHome();

  const [createOpen, setCreateOpen] = useState(false);

  const orgBanners = (home.data?.banners ?? []).filter((b) => b.organizationId === organizationId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Storefront</h1>
        <p className="text-muted-foreground mt-0.5">Manage your products, orders, and revenue</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground max-w-2xl">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        A custom landing-page builder (hero/testimonials/FAQs/CSS) isn't backend-supported and was removed. Payment capture is deferred (D8) — orders awaiting payment can't be fulfilled yet.
      </div>

      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
        </TabsList>

        {/* Orders */}
        <TabsContent value="orders">
          <Card>
            <CardHeader className="py-4 px-6 border-b"><CardTitle className="text-lg flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Orders</CardTitle></CardHeader>
            <CardContent className="p-0">
              {orders.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading orders…</div>
              ) : orders.isError ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load orders.<Button variant="outline" size="sm" onClick={() => orders.refetch()}>Retry</Button></div>
              ) : (orders.data ?? []).length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><ShoppingBag className="w-8 h-8 opacity-40" /> No orders yet.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Placed</TableHead><TableHead className="text-right">Fulfil</TableHead></TableRow></TableHeader>
                  <TableBody>{orders.data!.map((o) => <OrderRow key={o.id} order={o} />)}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue (real) */}
        <TabsContent value="revenue" className="space-y-4">
          {revenue.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
          ) : revenue.isError ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load revenue.<Button variant="outline" size="sm" onClick={() => revenue.refetch()}>Retry</Button></div>
          ) : revenue.data ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><IndianRupee className="w-3 h-3" /> Revenue</p><p className="text-2xl font-bold">{rupeesFromPaise(revenue.data.revenue.revenuePaise)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">GST collected</p><p className="text-2xl font-bold">{rupeesFromPaise(revenue.data.revenue.gstCollectedPaise)}</p></CardContent></Card>
                <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Revenue orders</p><p className="text-2xl font-bold">{revenue.data.revenue.revenueOrders}</p></CardContent></Card>
              </div>
              <Card>
                <CardHeader className="py-3 px-5 border-b"><CardTitle className="text-sm">By status</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Orders</TableHead><TableHead>Total</TableHead><TableHead>GST</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {revenue.data.byStatus.map((r) => (
                        <TableRow key={r.status}>
                          <TableCell><Badge className={`text-xs border-0 capitalize ${STATUS_COLOR[r.status]}`}>{r.status}</Badge></TableCell>
                          <TableCell className="text-sm">{r.orders}</TableCell>
                          <TableCell className="text-sm">{rupeesFromPaise(r.totalPaise)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{rupeesFromPaise(r.gstPaise)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">Revenue counts only confirmed-and-beyond orders ({revenue.data.countedStatuses.join(', ')}). Payouts/commission reporting aren't backend-supported.</p>
            </>
          ) : null}
        </TabsContent>

        {/* Products */}
        <TabsContent value="products">
          <Card>
            <CardHeader className="py-4 px-6 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><Package className="w-4 h-4" /> Products</CardTitle>
                <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!organizationId}><Plus className="w-4 h-4 mr-1.5" /> New Product</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {products.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading products…</div>
              ) : (products.data ?? []).length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground"><Package className="w-8 h-8 opacity-40" /> No active products.</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>GST</TableHead><TableHead>Rating</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {products.data!.map((p) => {
                      const v = p.variants?.[0];
                      return (
                        <TableRow key={p.id}>
                          <TableCell><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-muted-foreground font-mono">{p.slug}</p></TableCell>
                          <TableCell className="text-sm">{v ? rupeesFromPaise(v.pricePaise) : '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.gstRate}%</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.reviewCount > 0 ? `${p.avgRating}★ (${p.reviewCount})` : '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              <p className="text-xs text-muted-foreground px-6 py-3 border-t">Only active, published products are listable (no merchant draft-list endpoint).</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Banners */}
        <TabsContent value="banners">
          <Card>
            <CardHeader className="py-4 px-6 border-b"><CardTitle className="text-lg flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Banners</CardTitle></CardHeader>
            <CardContent className="p-4 space-y-2">
              {home.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>
              ) : orgBanners.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground text-sm">No active banners.</p>
              ) : orgBanners.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <div className="w-12 h-8 rounded" style={{ backgroundColor: b.bgColor }} />
                  <div className="flex-1 min-w-0"><p className="font-medium text-sm">{b.title}</p>{b.subtitle && <p className="text-xs text-muted-foreground">{b.subtitle}</p>}</div>
                  {!b.isActive && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateProductDialog open={createOpen} onClose={() => setCreateOpen(false)} organizationId={organizationId} />
    </div>
  );
}

function CreateProductDialog({ open, onClose, organizationId }: { open: boolean; onClose: () => void; organizationId?: string }) {
  const home = useShopHome();
  const [form, setForm] = useState({ name: '', slug: '', categoryId: '', shortDescription: '' });
  const create = useCreateProduct();
  const categories = home.data?.categories ?? [];

  function submit() {
    if (!organizationId) { toast.error('No organization in session'); return; }
    if (!form.name || !form.slug || !form.categoryId) { toast.error('Name, slug and category are required'); return; }
    create.mutate(
      { organizationId, name: form.name.trim(), slug: form.slug.trim(), categoryId: form.categoryId, shortDescription: form.shortDescription.trim() || undefined },
      { onSuccess: () => { toast.success('Product created (add a variant to set price)'); onClose(); setForm({ name: '', slug: '', categoryId: '', shortDescription: '' }); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not create product') },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Slug *</Label><Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') }))} className="font-mono text-xs" /></div>
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
              <SelectTrigger><SelectValue placeholder={categories.length ? 'Select category' : 'Loading…'} /></SelectTrigger>
              <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Short description</Label><Input value={form.shortDescription} onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
