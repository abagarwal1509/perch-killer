-- Manual Database Setup Script for Author System
-- Run this in Supabase SQL Editor

-- Step 1: Create authors table
CREATE TABLE IF NOT EXISTS authors (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  primary_source_url TEXT,
  twitter_handle TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  key_topics TEXT[],
  writing_style_summary TEXT,
  position_tracking JSONB DEFAULT '{}',
  content_stats JSONB DEFAULT '{}',
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  articles_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Add author_id to sources table
ALTER TABLE sources ADD COLUMN IF NOT EXISTS author_id BIGINT REFERENCES authors(id) ON DELETE SET NULL;

-- Step 3: Add new columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id BIGINT REFERENCES authors(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_enhanced BOOLEAN DEFAULT FALSE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_length INTEGER DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_analysis JSONB DEFAULT '{}';
ALTER TABLE articles ADD COLUMN IF NOT EXISTS key_quotes TEXT[];
ALTER TABLE articles ADD COLUMN IF NOT EXISTS main_themes TEXT[];
ALTER TABLE articles ADD COLUMN IF NOT EXISTS contradicts_previous BOOLEAN DEFAULT FALSE;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS related_article_ids BIGINT[];

-- Step 4: Create author evolution table
CREATE TABLE IF NOT EXISTS author_evolution (
  id BIGSERIAL PRIMARY KEY,
  author_id BIGINT REFERENCES authors(id) ON DELETE CASCADE,
  article_id BIGINT REFERENCES articles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  previous_position TEXT,
  current_position TEXT,
  confidence_score FLOAT DEFAULT 0.0,
  evolution_type TEXT CHECK (evolution_type IN ('contradiction', 'refinement', 'expansion', 'reversal')),
  supporting_quotes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Add indexes
CREATE INDEX IF NOT EXISTS idx_authors_user_id ON authors(user_id);
CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug);
CREATE INDEX IF NOT EXISTS idx_authors_is_featured ON authors(is_featured);
CREATE INDEX IF NOT EXISTS idx_authors_key_topics ON authors USING GIN(key_topics);

CREATE INDEX IF NOT EXISTS idx_sources_author_id ON sources(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_main_themes ON articles USING GIN(main_themes);
CREATE INDEX IF NOT EXISTS idx_articles_contradicts_previous ON articles(contradicts_previous);
CREATE INDEX IF NOT EXISTS idx_articles_ai_analysis ON articles USING GIN(ai_analysis);

CREATE INDEX IF NOT EXISTS idx_author_evolution_author_id ON author_evolution(author_id);
CREATE INDEX IF NOT EXISTS idx_author_evolution_article_id ON author_evolution(article_id);
CREATE INDEX IF NOT EXISTS idx_author_evolution_topic ON author_evolution(topic);
CREATE INDEX IF NOT EXISTS idx_author_evolution_type ON author_evolution(evolution_type);

-- Step 6: Enable RLS
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_evolution ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for authors
CREATE POLICY "Users can view their own authors" ON authors
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own authors" ON authors
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own authors" ON authors
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own authors" ON authors
    FOR DELETE USING (auth.uid() = user_id);

-- Step 8: Create RLS policies for author_evolution
CREATE POLICY "Users can view their own author evolution" ON author_evolution
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM authors WHERE id = author_evolution.author_id
    ));

CREATE POLICY "Users can insert their own author evolution" ON author_evolution
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM authors WHERE id = author_evolution.author_id
    ));

CREATE POLICY "Users can update their own author evolution" ON author_evolution
    FOR UPDATE USING (auth.uid() IN (
        SELECT user_id FROM authors WHERE id = author_evolution.author_id
    ));

CREATE POLICY "Users can delete their own author evolution" ON author_evolution
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM authors WHERE id = author_evolution.author_id
    ));

-- Step 9: Create updated triggers
CREATE OR REPLACE FUNCTION update_author_articles_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE authors 
        SET articles_count = articles_count + 1
        WHERE id = NEW.author_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE authors 
        SET articles_count = articles_count - 1
        WHERE id = OLD.author_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.author_id IS DISTINCT FROM NEW.author_id THEN
            IF OLD.author_id IS NOT NULL THEN
                UPDATE authors SET articles_count = articles_count - 1 WHERE id = OLD.author_id;
            END IF;
            IF NEW.author_id IS NOT NULL THEN
                UPDATE authors SET articles_count = articles_count + 1 WHERE id = NEW.author_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_author_articles_count
    AFTER INSERT OR UPDATE OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_author_articles_count();

CREATE TRIGGER update_authors_updated_at 
    BEFORE UPDATE ON authors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 10: Create views (using CREATE OR REPLACE to avoid conflicts)
CREATE OR REPLACE VIEW articles_with_sources AS
SELECT 
    a.*,
    s.name as source_name,
    s.url as source_url,
    auth.name as author_name,
    auth.slug as author_slug,
    auth.avatar_url as author_avatar_url
FROM articles a
JOIN sources s ON a.source_id = s.id
LEFT JOIN authors auth ON a.author_id = auth.id;

CREATE OR REPLACE VIEW articles_summary AS
SELECT 
    a.id,
    a.source_id,
    a.user_id,
    a.author_id,
    a.title,
    a.description,
    LEFT(a.content, 200) as content_preview,
    a.url,
    a.author,
    a.published_at,
    a.image_url,
    a.categories,
    a.read_time,
    a.is_read,
    a.is_bookmarked,
    a.is_enhanced,
    a.content_length,
    a.main_themes,
    a.contradicts_previous,
    a.created_at,
    a.updated_at,
    s.name as source_name,
    s.url as source_url,
    auth.name as author_name,
    auth.slug as author_slug,
    auth.avatar_url as author_avatar_url
FROM articles a
JOIN sources s ON a.source_id = s.id
LEFT JOIN authors auth ON a.author_id = auth.id;

-- Drop the existing author_profiles view first if it exists
DROP VIEW IF EXISTS author_profiles;

CREATE VIEW author_profiles AS
SELECT 
    a.id,
    a.user_id,
    a.name,
    a.slug,
    a.bio,
    a.avatar_url,
    a.primary_source_url,
    a.twitter_handle,
    a.linkedin_url,
    a.website_url,
    a.key_topics,
    a.writing_style_summary,
    a.position_tracking,
    a.content_stats,
    a.last_analyzed_at,
    a.articles_count,
    a.is_featured,
    a.created_at,
    a.updated_at,
    (
        SELECT COUNT(*) 
        FROM articles art 
        WHERE art.author_id = a.id AND art.contradicts_previous = true
    ) as contradiction_count,
    (
        SELECT published_at 
        FROM articles art 
        WHERE art.author_id = a.id 
        ORDER BY published_at DESC 
        LIMIT 1
    ) as last_published_at,
    (
        SELECT array_agg(DISTINCT theme) 
        FROM articles art, unnest(art.main_themes) as theme 
        WHERE art.author_id = a.id 
        LIMIT 20
    ) as all_themes
FROM authors a;

-- Step 11: Grant permissions
GRANT ALL ON authors TO authenticated;
GRANT ALL ON author_evolution TO authenticated;
GRANT SELECT ON author_profiles TO authenticated;
GRANT ALL ON SEQUENCE authors_id_seq TO authenticated;
GRANT ALL ON SEQUENCE author_evolution_id_seq TO authenticated;

-- Step 12: Insert Sam Altman as the first featured author (you can uncomment this after creating a user)
INSERT INTO authors (
  user_id,
  name,
  slug,
  bio,
  avatar_url,
  primary_source_url,
  twitter_handle,
  website_url,
  key_topics,
  is_featured,
  position_tracking
) VALUES (
  auth.uid(), -- This will use the current authenticated user
  'Sam Altman',
  'sam-altman',
  'CEO of OpenAI, former president of Y Combinator, and leading voice in AI development and startups.',
  'https://pbs.twimg.com/profile_images/804990434455887872/BG0Xh2LJ_400x400.jpg',
  'https://blog.samaltman.com',
  'sama',
  'https://blog.samaltman.com',
  ARRAY['AI', 'AGI', 'startups', 'technology', 'OpenAI', 'regulation', 'safety'],
  true,
  '{
    "AGI Timeline": "Believes AGI is possible within this decade",
    "AI Safety": "Advocates for careful development and regulation",
    "AI Regulation": "Supports thoughtful government oversight"
  }'::jsonb
); 