import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, BookOpen, Loader2, AlertCircle, Clock, Users } from 'lucide-react';
import { useRecipes } from '@/lib/nutrition';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function Recipes() {
  const [, navigate] = useLocation();
  const { data: recipes = [], isLoading, isError, refetch } = useRecipes();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? recipes.filter((r) => r.title.toLowerCase().includes(needle)) : recipes;
  }, [recipes, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Recipes</h1>
          <p className="text-muted-foreground mt-0.5">{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate(`${BASE}/admin/recipes/new`)}><Plus className="w-4 h-4 mr-2" /> New Recipe</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recipes…" className="pl-8" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading recipes…</div>
      ) : isError ? (
        <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load recipes.<Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground"><BookOpen className="w-8 h-8 opacity-40" />{recipes.length === 0 ? 'No recipes yet.' : 'No recipes match your search.'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <Card key={r.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`${BASE}/admin/recipes/${r.id}`)}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{r.title}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {r.description && <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {r.servings != null && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{r.servings} servings</span>}
                  {r.prepMinutes != null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{r.prepMinutes} min</span>}
                  {r.totalCalories != null && <span>{r.totalCalories} kcal</span>}
                  {r.isPublic && <Badge variant="secondary" className="text-[10px]">Public</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
