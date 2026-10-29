CREATE TABLE IF NOT EXISTS public.author_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    subscriber_email TEXT NOT NULL,
    subscriber_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (author_id, subscriber_email)
);

ALTER TABLE public.author_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscribers" 
    ON public.author_subscribers FOR SELECT 
    USING (auth.uid() = author_id);

CREATE POLICY "Anyone can subscribe" 
    ON public.author_subscribers FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Subscribers can unsubscribe" 
    ON public.author_subscribers FOR DELETE 
    USING (
        (auth.uid() IS NOT NULL AND auth.uid() = subscriber_id)
        OR 
        (auth.uid() = author_id)
    );
