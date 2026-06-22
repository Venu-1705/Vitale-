import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit2, Loader2, AlertCircle, Clock, Users } from 'lucide-react';
import { useRecipe } from '@/lib/nutrition';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: recipe, isLoading, isError, refetch } = useRecipe(id);

  if (isLoading) {
    return <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading recipe…</div>;
  }
  if (isError || !recipe) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
        <AlertCircle className="w-7 h-7 text-destructive" /> Couldn't load this recipe.
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button><Button variant="ghost" size="sm" onClick={() => navigate(`${BASE}/admin/recipes`)}>Back</Button></div>
      </div>
    );
  }

  const instructions = Array.isArray(recipe.instructions) ? (recipe.instructions as unknown[]) : [];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`${BASE}/admin/recipes`)}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{recipe.title}</h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {recipe.servings != null && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{recipe.servings} servings</span>}
            {recipe.prepMinutes != null && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{recipe.prepMinutes} min</span>}
            {recipe.totalCalories != null && <span>{recipe.totalCalories} kcal</span>}
            {recipe.isPublic && <Badge variant="secondary" className="text-[10px]">Public</Badge>}
          </div>
        </div>
        <Button size="sm" onClick={() => navigate(`${BASE}/admin/recipes/${recipe.id}/edit`)}><Edit2 className="w-4 h-4 mr-1.5" /> Edit</Button>
      </div>

      {recipe.description && (
        <Card><CardHeader><CardTitle className="text-base">About</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{recipe.description}</p></CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Ingredients</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No ingredients listed.</p>
          ) : recipe.ingredients.map((ing) => (
            <div key={ing.id} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
              <span>{ing.name}</span>
              {ing.quantityG != null && <span className="text-muted-foreground">{ing.quantityG} g</span>}
            </div>
          ))}
        </CardContent>
      </Card>

      {instructions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Instructions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {instructions.map((step, i) => (
              <div key={i} className="flex gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                <span>{typeof step === 'string' ? step : JSON.stringify(step)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
