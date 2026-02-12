import math


def normalize_pagination(page: int, page_size: int, *, max_page_size: int = 100) -> tuple[int, int]:
    safe_page = max(1, page)
    safe_page_size = min(max_page_size, max(1, page_size))
    return safe_page, safe_page_size


def paginate_queryset(queryset, page: int, page_size: int):
    page, page_size = normalize_pagination(page, page_size)
    total = queryset.count()
    total_pages = math.ceil(total / page_size) if total else 0
    start = (page - 1) * page_size
    end = start + page_size
    items = queryset[start:end]
    pagination = {
        "page": page,
        "pageSize": page_size,
        "total": total,
        "totalPages": total_pages,
    }
    return items, pagination
