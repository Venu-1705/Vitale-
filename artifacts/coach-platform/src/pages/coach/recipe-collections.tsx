import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderTree, Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Recipe Collections — NOT BACKED. D4 has recipes (+ ingredients) but no
 * "collection" entity to group them. Rather than fabricate collections, this
 * surfaces the truth and points to the real recipe list.
 */
export default function RecipeCollections() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Recipe Collections</h1>
        <p className="text-muted-foreground">Group recipes into collections</p>
      </div>
      <Card>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center"><FolderTree className="w-7 h-7 text-muted-foreground" /></div>
            <h2 className="text-lg font-semibold">Collections aren't available yet</h2>
            <p className="text-sm text-muted-foreground">The nutrition backend has recipes and ingredients, but no collection/grouping entity. Collections would need a new domain, so this is disabled rather than faked.</p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" /> All recipes are managed individually on the Recipes page.
            </div>
            <Button onClick={() => navigate(`${BASE}/admin/recipes`)}>Go to Recipes</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
