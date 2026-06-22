import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  MessageSquare, Heart, Loader2, AlertCircle, Info, Send, Megaphone, Flag,
  EyeOff, Users, ShieldAlert, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import {
  useCommunityPosts, useCreatePost, useUpdatePost, useLikePost,
  usePostComments, useCreateComment,
  useCommunityMembers, usePostFlags, useTriageFlag,
  type CommunityPost, type PostType, type PostStatus, type FlagStatus,
} from '@/lib/community';

const short = (id: string) => id.slice(0, 8);
const fmt = (s: string) => new Date(s).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const TYPE_BADGE: Record<PostType, string> = {
  text: 'bg-slate-100 text-slate-700', image: 'bg-blue-100 text-blue-700', recipe: 'bg-green-100 text-green-700',
  poll: 'bg-purple-100 text-purple-700', announcement: 'bg-amber-100 text-amber-700',
};
const STATUS_BADGE: Record<PostStatus, string> = {
  active: 'bg-green-100 text-green-700', hidden: 'bg-amber-100 text-amber-700', removed: 'bg-red-100 text-red-700',
};

function Comments({ postId }: { postId: string }) {
  const comments = usePostComments(postId);
  const create = useCreateComment(postId);
  const [text, setText] = useState('');
  return (
    <div className="mt-2 pl-3 border-l-2 border-muted space-y-2">
      {comments.isLoading ? (
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Loading…</p>
      ) : (comments.data ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No comments.</p>
      ) : comments.data!.map((c) => (
        <div key={c.id} className="text-sm">
          <span className="font-mono text-xs text-muted-foreground">{short(c.authorUserId)}</span>
          <span className="ml-2">{c.body}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="h-8 text-sm" />
        <Button size="sm" className="h-8" disabled={!text.trim() || create.isPending}
          onClick={() => create.mutate({ body: text.trim() }, { onSuccess: () => setText(''), onError: () => toast.error('Could not comment') })}>
          {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function PostCard({ post, canModerate }: { post: CommunityPost; canModerate: boolean }) {
  const like = useLikePost();
  const update = useUpdatePost(post.id);
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{short(post.authorUserId).slice(0, 2).toUpperCase()}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono">{short(post.authorUserId)}</p>
            <p className="text-[11px] text-muted-foreground">{fmt(post.createdAt)}</p>
          </div>
          <Badge className={`text-[10px] border-0 capitalize ${TYPE_BADGE[post.postType]}`}>{post.postType}</Badge>
          {post.status !== 'active' && <Badge className={`text-[10px] border-0 capitalize ${STATUS_BADGE[post.status]}`}>{post.status}</Badge>}
          {post.isPinned && <Badge variant="secondary" className="text-[10px]">Pinned</Badge>}
        </div>
        {post.body && <p className="text-sm whitespace-pre-wrap">{post.body}</p>}
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          <button className={`flex items-center gap-1 hover:text-foreground ${liked ? 'text-rose-600' : ''}`}
            onClick={() => { like.mutate({ postId: post.id, liked }); setLiked((v) => !v); }}>
            <Heart className={`w-4 h-4 ${liked ? 'fill-rose-600' : ''}`} /> {post.likeCount}
          </button>
          <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setShowComments((v) => !v)}>
            <MessageSquare className="w-4 h-4" /> {post.commentCount}
          </button>
          {canModerate && post.status === 'active' && (
            <button className="flex items-center gap-1 hover:text-amber-600 ml-auto"
              onClick={() => update.mutate({ status: 'hidden' }, { onSuccess: () => toast.success('Post hidden'), onError: () => toast.error('Could not hide') })}>
              <EyeOff className="w-4 h-4" /> Hide
            </button>
          )}
          {canModerate && post.status === 'hidden' && (
            <button className="flex items-center gap-1 hover:text-green-600 ml-auto"
              onClick={() => update.mutate({ status: 'active' }, { onSuccess: () => toast.success('Post restored') })}>
              <Check className="w-4 h-4" /> Restore
            </button>
          )}
        </div>
        {showComments && <Comments postId={post.id} />}
      </CardContent>
    </Card>
  );
}

function FlagQueue({ status }: { status: FlagStatus }) {
  const flags = usePostFlags(status);
  const triage = useTriageFlag();
  if (flags.isLoading) return <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;
  if (flags.isError) return <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /><Button variant="outline" size="sm" onClick={() => flags.refetch()}>Retry</Button></div>;
  if ((flags.data ?? []).length === 0) return <div className="py-10 text-center text-muted-foreground text-sm">No {status} flags.</div>;
  return (
    <div className="space-y-2">
      {flags.data!.map((f) => (
        <Card key={f.id}><CardContent className="p-3 flex items-center gap-3">
          <Flag className="w-4 h-4 text-rose-500 shrink-0" />
          <div className="flex-1 min-w-0 text-sm">
            <p>{f.postId ? 'Post' : 'Comment'} <span className="font-mono">{short(f.postId ?? f.commentId ?? '')}</span> · <span className="capitalize">{f.reason}</span></p>
            <p className="text-xs text-muted-foreground">Reported by {short(f.reporterUserId)} · {fmt(f.createdAt)}</p>
          </div>
          <Badge className="text-[10px] border-0 capitalize bg-muted text-muted-foreground">{f.status}</Badge>
          {f.status === 'open' && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => triage.mutate({ id: f.id, status: 'actioned' }, { onSuccess: () => toast.success('Flag actioned') })}>Action</Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => triage.mutate({ id: f.id, status: 'dismissed' }, { onSuccess: () => toast.success('Flag dismissed') })}>Dismiss</Button>
            </div>
          )}
        </CardContent></Card>
      ))}
    </div>
  );
}

/**
 * Community (D11) — the org-wide feed. NOTE: the backend has no sub-channels,
 * access rules, categories, profanity filters, or engagement analytics — a
 * community is per-organization with posts/comments/likes/votes/flags. Those
 * fabricated channel-management + analytics surfaces were removed.
 */
export default function Community() {
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const isAdminOrCoach = useAuthStore((s) => s.user?.role === 'admin' || s.user?.role === 'coach');
  const posts = useCommunityPosts(organizationId ? { organizationId } : {});
  const members = useCommunityMembers(organizationId);
  const createPost = useCreatePost();

  const [composer, setComposer] = useState('');
  const [postType, setPostType] = useState<PostType>('text');

  function submit() {
    if (!organizationId) { toast.error('No organization in session'); return; }
    if (!composer.trim()) { toast.error('Write something first'); return; }
    createPost.mutate(
      { organizationId, postType, body: composer.trim() },
      { onSuccess: () => { toast.success('Posted'); setComposer(''); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Could not post') },
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold">Community</h1>
        <p className="text-muted-foreground mt-0.5">Your organization's community feed</p>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        Communities are organization-wide (no sub-channels in the backend). Moderation acts on posts and reported flags; there are no engagement-analytics or auto-moderation surfaces.
      </div>

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          {isAdminOrCoach && <TabsTrigger value="moderation">Moderation</TabsTrigger>}
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="space-y-4">
          {isAdminOrCoach && (
            <Card><CardContent className="p-4 space-y-3">
              <Textarea value={composer} onChange={(e) => setComposer(e.target.value)} rows={2} placeholder="Share an update with your community…" />
              <div className="flex items-center gap-2">
                <Select value={postType} onValueChange={(v) => setPostType(v as PostType)}>
                  <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="announcement"><span className="flex items-center gap-1"><Megaphone className="w-3.5 h-3.5" /> Announcement</span></SelectItem>
                  </SelectContent>
                </Select>
                <Button className="ml-auto" onClick={submit} disabled={createPost.isPending}>
                  {createPost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Post</>}
                </Button>
              </div>
            </CardContent></Card>
          )}
          {posts.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /> Loading feed…</div>
          ) : posts.isError ? (
            <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><AlertCircle className="w-6 h-6 text-destructive" /> Couldn't load the feed.<Button variant="outline" size="sm" onClick={() => posts.refetch()}>Retry</Button></div>
          ) : (posts.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground"><MessageSquare className="w-8 h-8 opacity-40" /> No posts yet.</div>
          ) : posts.data!.map((p) => <PostCard key={p.id} post={p} canModerate={isAdminOrCoach} />)}
        </TabsContent>

        {isAdminOrCoach && (
          <TabsContent value="moderation" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Open Flags</CardTitle></CardHeader>
              <CardContent><FlagQueue status="open" /></CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="members">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Members</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {members.isLoading ? (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
              ) : (members.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No community members yet.</p>
              ) : members.data!.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">{short(m.userId).slice(0, 2).toUpperCase()}</div>
                  <span className="flex-1 font-mono text-xs">{short(m.userId)}</span>
                  <Badge className={`text-[10px] border-0 capitalize ${m.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{m.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
