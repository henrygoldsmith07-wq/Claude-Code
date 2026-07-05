-- Create the 'users' table
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    whatsapp_number VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'users' table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Policy for 'users' table: authenticated users can view and update their own data
CREATE POLICY "Users can view their own data." ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data." ON public.users FOR UPDATE USING (auth.uid() = id);

-- Create the 'user_credentials' table
CREATE TABLE public.user_credentials (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    service_name VARCHAR(255) NOT NULL,
    encrypted_token JSONB NOT NULL,
    scopes TEXT[],
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'user_credentials' table
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- Policy for 'user_credentials' table: authenticated users can view and manage their own credentials
CREATE POLICY "User credentials can be viewed by owner." ON public.user_credentials FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User credentials can be inserted by owner." ON public.user_credentials FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User credentials can be updated by owner." ON public.user_credentials FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "User credentials can be deleted by owner." ON public.user_credentials FOR DELETE USING (auth.uid() = user_id);

-- Create the 'automation_logs' table
CREATE TABLE public.automation_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    loop_type VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    details JSONB,
    triggered_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'automation_logs' table
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

-- Policy for 'automation_logs' table: authenticated users can view their own logs
CREATE POLICY "Automation logs can be viewed by owner." ON public.automation_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Automation logs can be inserted by owner." ON public.automation_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create the 'calendar_events' table
CREATE TABLE public.calendar_events (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    event_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'calendar_events' table
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- Policy for 'calendar_events' table: authenticated users can view and manage their own events
CREATE POLICY "Calendar events can be viewed by owner." ON public.calendar_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Calendar events can be inserted by owner." ON public.calendar_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Calendar events can be updated by owner." ON public.calendar_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Calendar events can be deleted by owner." ON public.calendar_events FOR DELETE USING (auth.uid() = user_id);

-- Create the 'health_metrics' table
CREATE TABLE public.health_metrics (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    metric_type VARCHAR(255) NOT NULL,
    value NUMERIC NOT NULL,
    unit VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(255) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'health_metrics' table
ALTER TABLE public.health_metrics ENABLE ROW LEVEL SECURITY;

-- Policy for 'health_metrics' table: authenticated users can view and manage their own metrics
CREATE POLICY "Health metrics can be viewed by owner." ON public.health_metrics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Health metrics can be inserted by owner." ON public.health_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Health metrics can be updated by owner." ON public.health_metrics FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Health metrics can be deleted by owner." ON public.health_metrics FOR DELETE USING (auth.uid() = user_id);

-- Create the 'financial_transactions' table
CREATE TABLE public.financial_transactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) NOT NULL,
    amount NUMERIC NOT NULL,
    currency VARCHAR(10) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'financial_transactions' table
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Policy for 'financial_transactions' table: authenticated users can view and manage their own transactions
CREATE POLICY "Financial transactions can be viewed by owner." ON public.financial_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Financial transactions can be inserted by owner." ON public.financial_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Financial transactions can be updated by owner." ON public.financial_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Financial transactions can be deleted by owner." ON public.financial_transactions FOR DELETE USING (auth.uid() = user_id);

-- Create the 'knowledge_items' table
CREATE TABLE public.knowledge_items (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(255) NOT NULL,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'knowledge_items' table
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;

-- Policy for 'knowledge_items' table: authenticated users can view and manage their own knowledge items
CREATE POLICY "Knowledge items can be viewed by owner." ON public.knowledge_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Knowledge items can be inserted by owner." ON public.knowledge_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Knowledge items can be updated by owner." ON public.knowledge_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Knowledge items can be deleted by owner." ON public.knowledge_items FOR DELETE USING (auth.uid() = user_id);

-- Create the 'notifications' table
CREATE TABLE public.notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    channel VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'notifications' table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy for 'notifications' table: authenticated users can view and manage their own notifications
CREATE POLICY "Notifications can be viewed by owner." ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Notifications can be inserted by owner." ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Notifications can be updated by owner." ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Notifications can be deleted by owner." ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- Create the 'tasks' table
CREATE TABLE public.tasks (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(255) NOT NULL,
    source VARCHAR(255) NOT NULL,
    priority INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'tasks' table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Policy for 'tasks' table: authenticated users can view and manage their own tasks
CREATE POLICY "Tasks can be viewed by owner." ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Tasks can be inserted by owner." ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tasks can be updated by owner." ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Tasks can be deleted by owner." ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Create the 'media_listening_history' table
CREATE TABLE public.media_listening_history (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    artist_podcast VARCHAR(255),
    listen_start_time TIMESTAMP WITH TIME ZONE,
    listen_end_time TIMESTAMP WITH TIME ZONE,
    source VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'media_listening_history' table
ALTER TABLE public.media_listening_history ENABLE ROW LEVEL SECURITY;

-- Policy for 'media_listening_history' table: authenticated users can view and manage their own listening history
CREATE POLICY "Media listening history can be viewed by owner." ON public.media_listening_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Media listening history can be inserted by owner." ON public.media_listening_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Media listening history can be updated by owner." ON public.media_listening_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Media listening history can be deleted by owner." ON public.media_listening_history FOR DELETE USING (auth.uid() = user_id);

-- Create the 'settings' table
CREATE TABLE public.settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security for 'settings' table
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policy for 'settings' table: authenticated users can view and manage their own settings
CREATE POLICY "Settings can be viewed by owner." ON public.settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Settings can be inserted by owner." ON public.settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Settings can be updated by owner." ON public.settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Settings can be deleted by owner." ON public.settings FOR DELETE USING (auth.uid() = user_id);

-- Add unique constraint for settings table to ensure only one setting per user per key
CREATE UNIQUE INDEX user_settings_unique_key ON public.settings (user_id, key);
