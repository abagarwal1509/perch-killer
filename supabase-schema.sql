-- BlogHub Database Schema for Supabase

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret-here';

-- Create authors table for tracking thought leaders
CREATE TABLE IF NOT EXISTS authors (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- URL-friendly identifier (e.g., 'sam-altman')
  bio TEXT,
  avatar_url TEXT,
  primary_source_url TEXT, -- Main blog/substack URL
  twitter_handle TEXT,
  linkedin_url TEXT,
  website_url TEXT,
  key_topics TEXT[], -- AI, startups, technology, etc.
  writing_style_summary TEXT, -- AI-generated summary of writing patterns
  position_tracking JSONB DEFAULT '{}', -- Track evolving positions on key topics
  content_stats JSONB DEFAULT '{}', -- Word count, posting frequency, etc.
  last_analyzed_at TIMESTAMP WITH TIME ZONE,
  articles_count INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE, -- For highlighting key thought leaders
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sources table
CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES authors(id) ON DELETE SET NULL, -- Link to author if applicable
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'error', 'paused')),
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  articles_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT REFERENCES sources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id BIGINT REFERENCES authors(id) ON DELETE SET NULL, -- Direct link to author
  title TEXT NOT NULL,
  description TEXT,
  content TEXT, -- Can store up to 1GB of enhanced content
  url TEXT NOT NULL,
  author TEXT, -- Keep original author field for compatibility
  published_at TIMESTAMP WITH TIME ZONE,
  image_url TEXT,
  categories TEXT[],
  read_time TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  is_bookmarked BOOLEAN DEFAULT FALSE,
  is_enhanced BOOLEAN DEFAULT FALSE, -- Track if content has been enhanced
  content_length INTEGER DEFAULT 0, -- Track content size for optimization
  ai_analysis JSONB DEFAULT '{}', -- Store AI analysis results (themes, sentiment, etc.)
  key_quotes TEXT[], -- Extract important quotes for contradiction tracking
  main_themes TEXT[], -- AI-extracted themes from the article
  contradicts_previous BOOLEAN DEFAULT FALSE, -- Flag articles that contradict previous positions
  related_article_ids BIGINT[], -- Articles that discuss similar themes
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(source_id, url)
);

-- Create author evolution tracking table
CREATE TABLE IF NOT EXISTS author_evolution (
  id BIGSERIAL PRIMARY KEY,
  author_id BIGINT REFERENCES authors(id) ON DELETE CASCADE,
  article_id BIGINT REFERENCES articles(id) ON DELETE CASCADE,
  topic TEXT NOT NULL, -- The topic/theme being tracked
  previous_position TEXT, -- Previous stance on this topic
  current_position TEXT, -- New stance from this article
  confidence_score FLOAT DEFAULT 0.0, -- AI confidence in detecting the evolution
  evolution_type TEXT CHECK (evolution_type IN ('contradiction', 'refinement', 'expansion', 'reversal')),
  supporting_quotes TEXT[], -- Quotes that support this evolution
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
-- Authors table indexes
CREATE INDEX IF NOT EXISTS idx_authors_user_id ON authors(user_id);
CREATE INDEX IF NOT EXISTS idx_authors_slug ON authors(slug);
CREATE INDEX IF NOT EXISTS idx_authors_is_featured ON authors(is_featured);
CREATE INDEX IF NOT EXISTS idx_authors_key_topics ON authors USING GIN(key_topics);

-- Sources table indexes
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_author_id ON sources(author_id);
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);

-- Articles table indexes
CREATE INDEX IF NOT EXISTS idx_articles_source_id ON articles(source_id);
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_read ON articles(is_read);
CREATE INDEX IF NOT EXISTS idx_articles_is_bookmarked ON articles(is_bookmarked);
CREATE INDEX IF NOT EXISTS idx_articles_is_enhanced ON articles(is_enhanced);
CREATE INDEX IF NOT EXISTS idx_articles_content_length ON articles(content_length);
CREATE INDEX IF NOT EXISTS idx_articles_main_themes ON articles USING GIN(main_themes);
CREATE INDEX IF NOT EXISTS idx_articles_contradicts_previous ON articles(contradicts_previous);
CREATE INDEX IF NOT EXISTS idx_articles_ai_analysis ON articles USING GIN(ai_analysis);

-- Author evolution table indexes
CREATE INDEX IF NOT EXISTS idx_author_evolution_author_id ON author_evolution(author_id);
CREATE INDEX IF NOT EXISTS idx_author_evolution_article_id ON author_evolution(article_id);
CREATE INDEX IF NOT EXISTS idx_author_evolution_topic ON author_evolution(topic);
CREATE INDEX IF NOT EXISTS idx_author_evolution_type ON author_evolution(evolution_type);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update content metadata
CREATE OR REPLACE FUNCTION update_article_content_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update content length and enhancement status
    NEW.content_length = COALESCE(LENGTH(NEW.content), 0);
    NEW.is_enhanced = CASE 
        WHEN NEW.content_length > 500 THEN TRUE 
        ELSE FALSE 
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_authors_updated_at 
    BEFORE UPDATE ON authors 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sources_updated_at 
    BEFORE UPDATE ON sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for content metadata
CREATE TRIGGER update_articles_content_metadata 
    BEFORE INSERT OR UPDATE ON articles 
    FOR EACH ROW EXECUTE FUNCTION update_article_content_metadata();

-- Enable Row Level Security
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE author_evolution ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authors
CREATE POLICY "Users can view their own authors" ON authors
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own authors" ON authors
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own authors" ON authors
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own authors" ON authors
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for sources
CREATE POLICY "Users can view their own sources" ON sources
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sources" ON sources
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sources" ON sources
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sources" ON sources
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for articles
CREATE POLICY "Users can view their own articles" ON articles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own articles" ON articles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own articles" ON articles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own articles" ON articles
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for author_evolution
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

-- Create a function to update articles count
CREATE OR REPLACE FUNCTION update_source_articles_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE sources 
        SET articles_count = articles_count + 1
        WHERE id = NEW.source_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE sources 
        SET articles_count = articles_count - 1
        WHERE id = OLD.source_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update articles count
CREATE TRIGGER trigger_update_articles_count
    AFTER INSERT OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_source_articles_count();

-- Create a function to update author articles count
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
        -- Handle author_id changes
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

-- Create trigger to automatically update author articles count
CREATE TRIGGER trigger_update_author_articles_count
    AFTER INSERT OR UPDATE OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_author_articles_count();

-- Create a view for articles with source and author information
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

-- Create a view for articles with basic info (without large content field)
CREATE OR REPLACE VIEW articles_summary AS
SELECT 
    a.id,
    a.source_id,
    a.user_id,
    a.author_id,
    a.title,
    a.description,
    LEFT(a.content, 200) as content_preview, -- Only first 200 chars
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

-- Create a view for author profiles with their latest content
CREATE OR REPLACE VIEW author_profiles AS
SELECT 
    a.*,
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

-- Grant necessary permissions
GRANT ALL ON authors TO authenticated;
GRANT ALL ON sources TO authenticated;
GRANT ALL ON articles TO authenticated;
GRANT ALL ON author_evolution TO authenticated;
GRANT SELECT ON articles_with_sources TO authenticated;
GRANT SELECT ON articles_summary TO authenticated;
GRANT SELECT ON author_profiles TO authenticated;
GRANT ALL ON SEQUENCE authors_id_seq TO authenticated;
GRANT ALL ON SEQUENCE sources_id_seq TO authenticated;
GRANT ALL ON SEQUENCE articles_id_seq TO authenticated;
GRANT ALL ON SEQUENCE author_evolution_id_seq TO authenticated; 