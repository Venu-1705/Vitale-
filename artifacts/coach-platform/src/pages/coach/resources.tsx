import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookMarked, Info } from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Resource Library — NOT BACKED. There is no resource/content-library domain in the backend.
 * The original page rendered fabricated guides, infographics, and videos with fake view/download
 * counts. These were removed rather than invented.
 */
export default function Resources() {
  const [, navigate] = useLocation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Resource Library</h1>
        <p className="text-muted-foreground">Manage and share educational resources, guides, videos, and tools with your clients</p>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookMarked className="w-5 h-5 text-primary" /> Not available
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted mx-auto flex items-center justify-center">
              <BookMarked className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold">Resource Library isn't available yet</h2>
            <p className="text-sm text-muted-foreground">
              There's no backend domain for storing or managing educational resources, guides, videos, or tools.
              The data shown previously was mock-only and was removed rather than fabricated.
            </p>
            <div className="text-left text-sm text-muted-foreground bg-muted/40 rounded-lg p-4 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              Content you can manage today: Recipes (D4 Nutrition) and Programme curriculum (D3 Programs).
            </div>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => navigate(`${BASE}/admin/programs`)}>View Programs</Button>
              <Button variant="outline" onClick={() => navigate(`${BASE}/coach/recipes`)}>View Recipes</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
