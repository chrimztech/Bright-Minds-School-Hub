
CREATE OR REPLACE FUNCTION public.apply_inv_txn() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.direction IN ('in') THEN
    UPDATE public.inventory_items SET quantity = quantity + NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.direction IN ('out','damage','lost') THEN
    UPDATE public.inventory_items SET quantity = quantity - NEW.quantity WHERE id = NEW.item_id;
  ELSIF NEW.direction = 'adjust' THEN
    UPDATE public.inventory_items SET quantity = NEW.quantity WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.adjust_book_copies() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'borrowed' THEN
    UPDATE public.library_books SET copies_available = GREATEST(copies_available - 1, 0) WHERE id = NEW.book_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'borrowed' AND NEW.status IN ('returned','lost') THEN
    UPDATE public.library_books SET copies_available = copies_available + 1 WHERE id = NEW.book_id;
  END IF;
  RETURN NEW;
END $$;
