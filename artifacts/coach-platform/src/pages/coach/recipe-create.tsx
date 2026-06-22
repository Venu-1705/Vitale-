import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Plus, Trash2, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useCreateRecipe } from '@/lib/nutrition';
import { apiPost } from '@/lib/api';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface DraftIngredient { name: string; quantityG: string }

/**
 * Recipe authoring (D4). Creates the recipe, then appends ingredients via the
 * recipe-ingredients endpoint. NOTE: there's no recipe UPDATE endpoint, so this
 * is create-only; the /edit route lands here and creates a new recipe.
 */
export default function RecipeCreate() {
  const [, navigate] = useLocation();
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const createRecipe = useCreateRecipe();

  const [form, setForm] = useState({ title: '', description: '', servings: '', prepMinutes: '', totalCalories: '' });
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([{ name: '', quantityG: '' }]);
  const [creating, setCreating] = useState(false);

  // We need the created recipe id to attach ingredients — bind the hook after creation.
  async function submit() {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setCreating(true);
    createRecipe.mutate(
      {
        title: form.title.trim(),
        organizationId,
        description: form.description.trim() || undefined,
        servings: form.servings ? Number(form.servings) : undefined,
        prepMinutes: form.prepMinutes ? Number(form.prepMinutes) : undefined,
        totalCalories: form.totalCalories ? Number(form.totalCalories) : undefined,
      },
      {
        onSuccess: async (recipe) => {
          // Append ingredients sequentially via the transport.
          const valid = ingredients.filter((i) => i.name.trim());
          try {
            for (let idx = 0; idx < valid.length; idx++) {
              const ing = valid[idx];
              await apiPost(`/recipes/${recipe.id}/ingredients`, {
                name: ing.name.trim(),
                ...(ing.quantityG ? { quantityG: Number(ing.quantityG) } : {}),
                sortOrder: idx,
              });
            }
            toast.success('Recipe created');
            navigate(`${BASE}/admin/recipes/${recipe.id}`);
          } catch {
            toast.error('Recipe created, but some ingredients failed to save');
            navigate(`${BASE}/admin/recipes/${recipe.id}`);
          }
        },
        onError: (e: unknown) => { setCreating(false); toast.error(e instanceof Error ? e.message : 'Could not create recipe'); },
      },
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/recipes`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">New Recipe</h1>
          <p className="text-sm text-muted-foreground">Create a recipe and its ingredients</p>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Recipes are create-only (no update endpoint yet). Ingredients are added after the recipe is created.
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Servings</Label><Input type="number" min={1} value={form.servings} onChange={(e) => setForm((f) => ({ ...f, servings: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Prep (min)</Label><Input type="number" min={0} value={form.prepMinutes} onChange={(e) => setForm((f) => ({ ...f, prepMinutes: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Calories</Label><Input type="number" min={0} value={form.totalCalories} onChange={(e) => setForm((f) => ({ ...f, totalCalories: e.target.value }))} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Ingredients</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input className="flex-1" value={ing.name} onChange={(e) => setIngredients((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={`Ingredient ${i + 1}`} />
              <Input className="w-28" type="number" min={0} value={ing.quantityG} onChange={(e) => setIngredients((arr) => arr.map((x, j) => (j === i ? { ...x, quantityG: e.target.value } : x)))} placeholder="grams" />
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setIngredients((arr) => arr.filter((_, j) => j !== i))} disabled={ingredients.length === 1}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setIngredients((arr) => [...arr, { name: '', quantityG: '' }])}><Plus className="w-3.5 h-3.5 mr-1" /> Add ingredient</Button>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(`${BASE}/admin/recipes`)}>Cancel</Button>
        <Button onClick={submit} disabled={creating || createRecipe.isPending}>{creating || createRecipe.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Recipe'}</Button>
      </div>
    </div>
  );
}
